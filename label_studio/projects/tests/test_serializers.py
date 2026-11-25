from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from projects.serializers import ProjectSerializer
from projects.tests.factories import ProjectFactory
from tasks.tests.factories import AnnotationFactory, TaskFactory
from users.tests.factories import UserFactory


class TestProjectSerializer(TestCase):
    def test_queue_total_counts_unlabeled_tasks_and_tasks_annotated_by_the_user(self):
        project = ProjectFactory()
        current_user = project.created_by
        other_user = UserFactory()
        TaskFactory(project=project, is_labeled=False)
        current_user_task = TaskFactory(project=project)
        other_user_task = TaskFactory(project=project)
        unlabeled_other_user_task = TaskFactory(project=project)
        mixed_user_task = TaskFactory(project=project)
        AnnotationFactory(task=current_user_task, completed_by=current_user)
        AnnotationFactory(task=other_user_task, completed_by=other_user)
        AnnotationFactory(task=unlabeled_other_user_task, completed_by=other_user)
        AnnotationFactory(task=mixed_user_task, completed_by=other_user)
        AnnotationFactory(task=mixed_user_task, completed_by=current_user)
        project.tasks.filter(pk__in=[current_user_task.pk, other_user_task.pk, mixed_user_task.pk]).update(
            is_labeled=True
        )
        project.tasks.filter(pk=unlabeled_other_user_task.pk).update(is_labeled=False)
        serializer = ProjectSerializer(context={'user_cache': {current_user.id: current_user}})

        with CaptureQueriesContext(connection) as captured_queries:
            queue_total = serializer.get_queue_total(project)

        assert queue_total == 4
        assert len(captured_queries) == 1
        assert 'EXISTS' in captured_queries[0]['sql']
        assert 'DISTINCT' not in captured_queries[0]['sql']
