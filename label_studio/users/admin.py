'''This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
'''

from core.models import AsyncMigrationStatus
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group
from ml.models import MLBackend, MLBackendTrainJob
from organizations.models import Organization, OrganizationMember
from projects.models import Project, ProjectMember
from tasks.models import Annotation, Prediction, Task
from users.models import User
from django.contrib import messages
from django.shortcuts import redirect, render
from django.urls import path
from django import forms


# Inline configuration for project members
class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 1
    verbose_name = 'Project Member'
    verbose_name_plural = 'Project Members'
    raw_id_fields = ('user',)
    autocomplete_fields = ['user']

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "project":
            if request._obj_ is not None:  # We have an instance
                # Filter out projects where the user is already a member
                kwargs["queryset"] = Project.objects.exclude(
                    projectmember__user=request._obj_
                )
            else:
                kwargs["queryset"] = Project.objects.all()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


# Inline configuration for organization members
class OrganizationMemberInline(admin.TabularInline):
    model = OrganizationMember
    extra = 1


class UserProjectInline(admin.TabularInline):
    model = ProjectMember
    extra = 1
    verbose_name = 'Project Membership'
    verbose_name_plural = 'Project Memberships'
    raw_id_fields = ('project',)
    autocomplete_fields = ['project']


# Add new form for bulk user-project assignment
class BulkProjectAssignForm(forms.Form):
    users = forms.ModelMultipleChoiceField(
        queryset=User.objects.all(),
        widget=forms.SelectMultiple(attrs={'size': '10'})
    )
    projects = forms.ModelMultipleChoiceField(
        queryset=Project.objects.all(),
        widget=forms.SelectMultiple(attrs={'size': '10'})
    )


# Add new form for bulk organization-project assignment
class BulkOrganizationProjectAssignForm(forms.Form):
    organizations = forms.ModelMultipleChoiceField(
        queryset=Organization.objects.all(),
        widget=forms.SelectMultiple(attrs={'size': '10'})
    )
    projects = forms.ModelMultipleChoiceField(
        queryset=Project.objects.all(),
        widget=forms.SelectMultiple(attrs={'size': '10'})
    )


class UserAdminShort(UserAdmin):

    add_fieldsets = ((None, {'fields': ('email', 'password1', 'password2')}),)

    def __init__(self, *args, **kwargs):
        super(UserAdminShort, self).__init__(*args, **kwargs)

        self.list_display = (
            'email',
            'username',
            'active_organization',
            'organization',
            'is_staff',
            'is_superuser',
        )
        self.list_filter = ('is_staff', 'is_superuser', 'is_active')
        self.search_fields = (
            'username',
            'first_name',
            'last_name',
            'email',
            'organization__title',
            'active_organization__title',
        )
        self.ordering = ('email',)

        self.fieldsets = (
            (None, {'fields': ('password',)}),
            ('Personal info', {'fields': ('email', 'username', 'first_name', 'last_name')}),
            (
                'Permissions',
                {
                    'fields': (
                        'is_active',
                        'is_staff',
                        'is_superuser',
                    )
                },
            ),
            ('Important dates', {'fields': ('last_login', 'date_joined')}),
        )

        self.inlines = [ProjectMemberInline]

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('bulk-assign/', self.admin_site.admin_view(self.bulk_assign_view), name='users_user_bulk-assign'),
        ]
        return custom_urls + urls

    def bulk_assign_view(self, request):
        if request.method == 'POST':
            form = BulkProjectAssignForm(request.POST)
            if form.is_valid():
                users = form.cleaned_data['users']
                projects = form.cleaned_data['projects']
                
                # Create ProjectMember entries for each user-project combination
                created_count = 0
                for user in users:
                    for project in projects:
                        _, created = ProjectMember.objects.get_or_create(
                            user=user,
                            project=project,
                            defaults={'enabled': True}
                        )
                        if created:
                            created_count += 1
                
                messages.success(request, f'Successfully created {created_count} project memberships')
                return redirect('..')
        else:
            form = BulkProjectAssignForm()

        # Add the form to the context and render the template
        context = {
            'title': 'Bulk Assign Users to Projects',
            'form': form,
            'opts': self.model._meta,
            **self.admin_site.each_context(request),
        }
        return render(request, 'admin/users/bulk_assign_form.html', context)

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['show_bulk_assign_button'] = True
        return super().changelist_view(request, extra_context=extra_context)

    def get_form(self, request, obj=None, **kwargs):
        # Store the object for use in ProjectMemberInline
        request._obj_ = obj
        return super().get_form(request, obj, **kwargs)


class AsyncMigrationStatusAdmin(admin.ModelAdmin):
    def __init__(self, *args, **kwargs):
        super(AsyncMigrationStatusAdmin, self).__init__(*args, **kwargs)

        self.list_display = ('id', 'name', 'project', 'status', 'created_at', 'updated_at', 'meta')
        self.list_filter = ('name', 'status')
        self.search_fields = ('name', 'project__id')
        self.ordering = ('id',)


class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_at')
    search_fields = ('title',)
    inlines = [OrganizationMemberInline]


class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by', 'created_at', 'get_members_count', 'organization')
    search_fields = ('title', 'created_by__email')
    inlines = [ProjectMemberInline]

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('bulk-org-assign/', self.admin_site.admin_view(self.bulk_org_assign_view), 
                 name='projects_project_bulk-org-assign'),
        ]
        return custom_urls + urls

    def bulk_org_assign_view(self, request):
        if request.method == 'POST':
            form = BulkOrganizationProjectAssignForm(request.POST)
            if form.is_valid():
                organizations = form.cleaned_data['organizations']
                projects = form.cleaned_data['projects']
                
                created_count = 0
                for project in projects:
                    for org in organizations:
                        # Update project organization
                        project.organization = org
                        project.save()
                        
                        # Add all organization members to the project
                        for member in org.organizationmember_set.filter(deleted_at__isnull=True):
                            _, created = ProjectMember.objects.get_or_create(
                                user=member.user,
                                project=project,
                                defaults={'enabled': True}
                            )
                            if created:
                                created_count += 1
                
                messages.success(request, 
                    f'Successfully assigned {len(projects)} projects to {len(organizations)} organizations '
                    f'and created {created_count} project memberships')
                return redirect('..')
        else:
            form = BulkOrganizationProjectAssignForm()

        context = {
            'title': 'Bulk Assign Projects to Organizations',
            'form': form,
            'opts': self.model._meta,
            **self.admin_site.each_context(request),
        }
        return render(request, 'admin/projects/bulk_org_assign_form.html', context)

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['show_bulk_org_assign_button'] = True
        return super().changelist_view(request, extra_context=extra_context)

    def get_members_count(self, obj):
        return obj.members.count()

    get_members_count.short_description = 'Number of Members'


class OrganizationMemberAdmin(admin.ModelAdmin):
    def __init__(self, *args, **kwargs):
        super(OrganizationMemberAdmin, self).__init__(*args, **kwargs)

        self.list_display = ('id', 'user', 'organization', 'created_at', 'updated_at')
        self.search_fields = ('user__email', 'organization__title')
        self.ordering = ('id',)


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'project', 'enabled')
    list_filter = ('enabled',)
    search_fields = ('user__username', 'project__title')


admin.site.register(User, UserAdminShort)
admin.site.register(Project, ProjectAdmin)
admin.site.register(MLBackend)
admin.site.register(MLBackendTrainJob)
admin.site.register(Task)
admin.site.register(Annotation)
admin.site.register(Prediction)
admin.site.register(Organization, OrganizationAdmin)
admin.site.register(OrganizationMember, OrganizationMemberAdmin)
admin.site.register(AsyncMigrationStatus, AsyncMigrationStatusAdmin)

# remove unused django groups
admin.site.unregister(Group)
