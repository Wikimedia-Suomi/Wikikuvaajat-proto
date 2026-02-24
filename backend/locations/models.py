from django.db import models
from django.utils import timezone


class CommonsCategoryImageCountCache(models.Model):
    category_name = models.CharField(max_length=255, unique=True)
    image_count = models.PositiveIntegerField(default=0)
    fetched_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['category_name']

    def __str__(self) -> str:
        return f'{self.category_name}: {self.image_count}'


class ViewItImageCountCache(models.Model):
    wikidata_qid = models.CharField(max_length=32, unique=True)
    image_count = models.PositiveIntegerField(default=0)
    fetched_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['wikidata_qid']

    def __str__(self) -> str:
        return f'{self.wikidata_qid}: {self.image_count}'
