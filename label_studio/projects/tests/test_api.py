from datetime import datetime
from datetime import timezone as datetime_timezone

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.utils.http import urlencode
from freezegun import freeze_time
from organizations.tests.factories import OrganizationFactory
from projects.models import ProjectMember
from projects.tests.factories import ProjectFactory
from rest_framework.test import APIClient, APITestCase
from tasks.models import Annotation, Task
from tasks.tests.factories import AnnotationFactory, PredictionFactory, TaskFactory


class TestProjectCountsListAPI(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.project_1 = ProjectFactory()
        cls.project_2 = ProjectFactory(organization=cls.project_1.organization)
        Task.objects.create(project=cls.project_1, data={'text': 'Task 1'})
        Task.objects.create(project=cls.project_1, data={'text': 'Task 2'})
        Task.objects.create(project=cls.project_2, data={'text': 'Task 3'})

    def get_url(self, **params):
        return f'{reverse("projects:api:project-counts-list")}?{urlencode(params)}'

    def test_get_counts(self):
        client = APIClient()
        client.force_authenticate(user=self.project_1.created_by)
        response = client.get(self.get_url(include='id,task_number,finished_task_number,total_predictions_number'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 2)
        expected = [
            {
                'id': self.project_1.id,
                'task_number': 2,
                'finished_task_number': 0,
                'total_predictions_number': 0,
            },
            {
                'id': self.project_2.id,
                'task_number': 1,
                'finished_task_number': 0,
                'total_predictions_number': 0,
            },
        ]
        actual = sorted(response.json()['results'], key=lambda d: d['id'])
        self.assertEqual(actual, expected)


class TestWeeklyMetricsAPI(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.user = cls.project.created_by
        ProjectMember.objects.get_or_create(user=cls.user, project=cls.project)
        cls.task = TaskFactory(project=cls.project)

    @staticmethod
    def set_created_at(annotation, created_at):
        Annotation.objects.filter(id=annotation.id).update(created_at=created_at)

    def create_annotation(self, created_at, lead_time=60, was_cancelled=False):
        annotation = AnnotationFactory(
            task=self.task,
            completed_by=self.user,
            lead_time=lead_time,
            was_cancelled=was_cancelled,
            result=[{'value': {}}],
        )
        self.set_created_at(annotation, created_at)
        return annotation

    @freeze_time('2026-07-09T12:00:00Z')
    def test_project_weekly_annotation_count_starts_monday_morning(self):
        sunday = datetime(2026, 7, 5, 23, 59, tzinfo=datetime_timezone.utc)
        monday = datetime(2026, 7, 6, 0, 0, tzinfo=datetime_timezone.utc)
        tuesday = datetime(2026, 7, 7, 12, 0, tzinfo=datetime_timezone.utc)

        self.create_annotation(sunday)
        self.create_annotation(monday)
        self.create_annotation(tuesday)
        self.create_annotation(tuesday, was_cancelled=True)

        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get(
            reverse('projects:api:project-list'),
            {
                'ids': str(self.project.id),
                'include': 'id,weekly_annotation_count',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['results'][0]['weekly_annotation_count'], 2)

    @freeze_time('2026-07-09T12:00:00Z')
    def test_user_metrics_week_starts_monday_morning(self):
        sunday = datetime(2026, 7, 5, 23, 59, tzinfo=datetime_timezone.utc)
        monday = datetime(2026, 7, 6, 0, 0, tzinfo=datetime_timezone.utc)
        wednesday = datetime(2026, 7, 8, 12, 0, tzinfo=datetime_timezone.utc)

        self.create_annotation(sunday, lead_time=3600)
        self.create_annotation(monday, lead_time=1800)
        self.create_annotation(wednesday, lead_time=900)

        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get(reverse('projects:api:user-metrics'))

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['annotations_week'], 2)
        self.assertEqual(data['total_time_week'], 0.8)


class TestProjectModelVersionsAPI(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.user = cls.project.created_by

        cls.task = TaskFactory(project=cls.project)
        cls.prediction_m1 = PredictionFactory(task=cls.task, model_version='model_1')
        cls.prediction_m1_2 = PredictionFactory(task=cls.task, model_version='model_1')
        cls.prediction_m2 = PredictionFactory(task=cls.task, model_version='model_2')
        cls.prediction_m3 = PredictionFactory(task=cls.task, model_version='model_3')

        # To test ordering by last used
        cls.prediction_m2.created_at = timezone.now()
        cls.prediction_m2.save()

    def test_no_params(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/projects/{self.project.id}/model-versions')
        assert response.status_code == 200
        assert response.json() == {
            'model_2': 1,
            'model_3': 1,
            'model_1': 2,
        }

    def test_limit(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/projects/{self.project.id}/model-versions?limit=2')
        assert response.status_code == 200
        assert response.json() == {
            'model_2': 1,
            'model_3': 1,
        }

    def test_extended(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/projects/{self.project.id}/model-versions?extended=true')
        assert response.status_code == 200
        assert response.json()['live'] is None
        assert response.json()['static'][0]['model_version'] == 'model_2'
        assert response.json()['static'][0]['count'] == 1
        assert response.json()['static'][1]['model_version'] == 'model_3'
        assert response.json()['static'][1]['count'] == 1
        assert response.json()['static'][2]['model_version'] == 'model_1'
        assert response.json()['static'][2]['count'] == 2


class TestCrossOrganizationProjectAccessAPI(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.active_organization = OrganizationFactory()
        cls.link_organization = OrganizationFactory()
        cls.user = cls.active_organization.created_by
        cls.user.active_organization = cls.active_organization
        cls.user.save(update_fields=['active_organization'])
        cls.link_organization.add_user(cls.user)
        cls.project = ProjectFactory(organization=cls.link_organization)

    def test_project_detail_uses_organization_membership_not_active_organization(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(f'/api/projects/{self.project.id}/')

        assert response.status_code == 200
        assert response.json()['id'] == self.project.id

    def test_project_list_remains_active_organization_scoped(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/projects/')

        assert response.status_code == 200
        assert self.project.id not in {project['id'] for project in response.json()['results']}

    def test_project_update_remains_active_organization_scoped(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(f'/api/projects/{self.project.id}/', data={'title': 'changed'}, format='json')

        assert response.status_code == 404
        self.project.refresh_from_db()
        assert self.project.title != 'changed'

    def test_project_update_requires_project_membership_inside_active_organization(self):
        project = ProjectFactory(organization=self.active_organization)

        self.client.force_authenticate(user=self.user)
        response = self.client.patch(f'/api/projects/{project.id}/', data={'title': 'changed'}, format='json')

        assert response.status_code == 404
        project.refresh_from_db()
        assert project.title != 'changed'
