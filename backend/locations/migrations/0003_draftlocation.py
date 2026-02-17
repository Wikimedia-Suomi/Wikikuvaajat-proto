from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('locations', '0002_project_sparql_endpoint'),
    ]

    operations = [
        migrations.CreateModel(
            name='DraftLocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('location_type', models.CharField(max_length=120)),
                ('wikidata_item', models.CharField(blank=True, max_length=255)),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('address_text', models.CharField(blank=True, max_length=255)),
                ('postal_code', models.CharField(blank=True, max_length=40)),
                ('municipality_p131', models.CharField(blank=True, max_length=255)),
                ('commons_category', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'project',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='draft_locations',
                        to='locations.project',
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
