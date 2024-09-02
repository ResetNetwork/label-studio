from rest_framework.permissions import SAFE_METHODS, BasePermission


class SuperUserInvitePermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        if not request.user.is_reset_super_user:
            return False
        return obj.has_permission(request.user)

    def has_permission(self, request, view):
        if not request.user.is_reset_super_user:
            return False
        return True


class UserWithEditPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        # Super user has all access
        if request.user.is_reset_super_user:
            return True

        # If not super user and method is not in allowed methods return false
        USER_EDIT_PERMISSION_METHODS = ("GET", "PUT", "PATCH", "HEAD", "OPTIONS")
        if request.method not in USER_EDIT_PERMISSION_METHODS:
            return False

        # A normal user can only update their own profile
        return obj == request.user


class AnnotationsPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        # Super user has all access
        if request.user.is_superuser:
            return True

        # Allow non-superusers to create, update, and partially update annotations
        if getattr(view, "action", None) in ["create", "update", "partial_update"]:
            return True

        # Only superusers can delete annotations
        if getattr(view, "action", None) == "destroy":
            return False

        ANNOTATION_PERMISSION_METHODS = ("GET", "PUT", "PATCH", "POST", "HEAD", "OPTIONS")
        if request.method in ANNOTATION_PERMISSION_METHODS:
            return True

        return obj.has_permission(request.user)

    def has_permission(self, request, view):
        # Super user has all access
        if request.user.is_superuser:
            return True

        # Allow non-superusers to create, update, and partially update annotations
        if getattr(view, "action", None) in ["create", "update", "partial_update"]:
            return True

        # Only superusers can delete annotations
        if getattr(view, "action", None) == "destroy":
            return False

        ANNOTATION_PERMISSION_METHODS = ("GET", "PUT", "PATCH", "POST", "HEAD", "OPTIONS")
        if request.method in ANNOTATION_PERMISSION_METHODS:
            return True
        return False


class SuperUserPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method not in SAFE_METHODS and not request.user.is_reset_super_user:
            return False
        return obj.has_permission(request.user)

    def has_permission(self, request, view):
        if request.method not in SAFE_METHODS and not request.user.is_reset_super_user:
            return False
        return True


class HasObjectPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.has_permission(request.user)


class MemberHasOwnerPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        if (
            request.method not in SAFE_METHODS
            and not request.user.own_organization
            and not request.user.is_reset_super_user
        ):
            return False

        return obj.has_permission(request.user)
