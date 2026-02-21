from core.feature_flags import flag_set
from core.utils.db import SQCount
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from tasks.models import Annotation, Prediction, Task
from django.utils import timezone
from datetime import timedelta


def annotate_task_number(queryset):
    tasks = Task.objects.filter(project=OuterRef('id')).values_list('id')
    return queryset.annotate(task_number=SQCount(tasks))


def annotate_finished_task_number(queryset):
    if flag_set('fflag_fix_back_plt_811_finished_task_number_01072025_short', user='auto'):
        return queryset.annotate(finished_task_number=Count('tasks', filter=Q(tasks__is_labeled=True)))
    else:
        tasks = Task.objects.filter(project=OuterRef('id'), is_labeled=True).values_list('id')
        return queryset.annotate(finished_task_number=SQCount(tasks))


def annotate_total_predictions_number(queryset):
    predictions = Prediction.objects.filter(project=OuterRef('id')).values('id')
    return queryset.annotate(total_predictions_number=SQCount(predictions))


def annotate_total_annotations_number(queryset):
    subquery = Annotation.objects.filter(Q(project=OuterRef('pk')) & Q(was_cancelled=False)).values('id')
    return queryset.annotate(total_annotations_number=SQCount(subquery))


def annotate_num_tasks_with_annotations(queryset):
    subquery = (
        Annotation.objects.filter(
            Q(project=OuterRef('pk')) & Q(ground_truth=False) & Q(was_cancelled=False) & Q(result__isnull=False)
        )
        .values('project')
        .annotate(c=Count('task_id', distinct=True))
        .values('c')[:1]
    )
    return queryset.annotate(
        num_tasks_with_annotations=Coalesce(
            Subquery(subquery, output_field=IntegerField()),
            0,
        )
    )


def annotate_useful_annotation_number(queryset):
    subquery = Annotation.objects.filter(
        Q(project=OuterRef('pk')) & Q(was_cancelled=False) & Q(ground_truth=False) & Q(result__isnull=False)
    ).values('id')
    return queryset.annotate(useful_annotation_number=SQCount(subquery))


def annotate_ground_truth_number(queryset):
    subquery = Annotation.objects.filter(Q(project=OuterRef('pk')) & Q(ground_truth=True)).values('id')
    return queryset.annotate(ground_truth_number=SQCount(subquery))


def annotate_skipped_annotations_number(queryset):
    subquery = Annotation.objects.filter(Q(project=OuterRef('pk')) & Q(was_cancelled=True)).values('id')
    return queryset.annotate(skipped_annotations_number=SQCount(subquery))


def annotate_weekly_annotation_count(queryset):
    """Returns number of annotations created in the last 7 days"""
    one_week_ago = timezone.now() - timedelta(days=7)
    annotations = Annotation.objects.filter(
        Q(project=OuterRef('id')) & 
        Q(created_at__gte=one_week_ago) &
        Q(was_cancelled=False)
    ).values('id')
    return queryset.annotate(weekly_annotation_count=SQCount(annotations))
