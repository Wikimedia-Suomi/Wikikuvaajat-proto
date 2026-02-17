from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('locations', '0003_draftlocation'),
    ]

    operations = [
        migrations.AddField(
            model_name='draftlocation',
            name='parent_uri',
            field=models.CharField(blank=True, default='', max_length=512),
        ),
    ]
