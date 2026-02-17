from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('locations', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='sparql_endpoint',
            field=models.URLField(blank=True, default=''),
        ),
    ]
