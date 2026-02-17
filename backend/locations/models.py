from django.db import models
from django.utils import timezone
import re


class DraftLocation(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location_type = models.CharField(max_length=120)
    wikidata_item = models.CharField(max_length=255, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address_text = models.CharField(max_length=255, blank=True)
    postal_code = models.CharField(max_length=40, blank=True)
    municipality_p131 = models.CharField(max_length=255, blank=True)
    commons_category = models.CharField(max_length=255, blank=True)
    parent_uri = models.CharField(max_length=512, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.name

    def wikidata_uri(self) -> str:
        value = self.wikidata_item.strip()
        if not value:
            return ''

        if value.startswith('http://') or value.startswith('https://'):
            return value

        match = re.match(r'^(Q\d+)$', value, flags=re.IGNORECASE)
        if match:
            return f'https://www.wikidata.org/entity/{match.group(1).upper()}'

        return ''

    def canonical_uri(self) -> str:
        wikidata_uri = self.wikidata_uri()
        if wikidata_uri:
            return wikidata_uri
        return f'https://draft.local/location/{self.id}'


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
