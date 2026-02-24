from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('locations', '0006_commonscategoryimagecountcache_viewitimagecountcache'),
    ]

    operations = [
        migrations.DeleteModel(
            name='DraftLocation',
        ),
    ]
