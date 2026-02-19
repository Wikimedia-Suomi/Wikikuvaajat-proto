import re

from rest_framework import serializers

from .models import DraftLocation


_WIKIDATA_QID_PATTERN = re.compile(r'(Q\d+)', flags=re.IGNORECASE)


def _normalize_wikidata_qid(value: str) -> str:
    match = _WIKIDATA_QID_PATTERN.search((value or '').strip())
    if not match:
        return ''
    return match.group(1).upper()


class LocationSerializer(serializers.Serializer):
    id = serializers.CharField()
    uri = serializers.URLField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    date_modified = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    source = serializers.CharField(required=False)
    draft_id = serializers.IntegerField(required=False, allow_null=True)
    location_type = serializers.CharField(required=False, allow_blank=True)
    wikidata_item = serializers.CharField(required=False, allow_blank=True)
    address_text = serializers.CharField(required=False, allow_blank=True)
    address_text_values = serializers.ListField(child=serializers.DictField(), required=False)
    postal_code = serializers.CharField(required=False, allow_blank=True)
    municipality_p131 = serializers.CharField(required=False, allow_blank=True)
    municipality_p131_label = serializers.CharField(required=False, allow_blank=True)
    municipality_p131_wikipedia_url = serializers.URLField(required=False, allow_blank=True)
    located_on_street_p669 = serializers.CharField(required=False, allow_blank=True)
    located_on_street_p669_label = serializers.CharField(required=False, allow_blank=True)
    located_on_street_p669_wikipedia_url = serializers.URLField(required=False, allow_blank=True)
    located_on_street_p669_values = serializers.ListField(child=serializers.DictField(), required=False)
    house_number_p670 = serializers.CharField(required=False, allow_blank=True)
    heritage_designation_p1435 = serializers.CharField(required=False, allow_blank=True)
    heritage_designation_p1435_label = serializers.CharField(required=False, allow_blank=True)
    heritage_designation_p1435_wikipedia_url = serializers.URLField(required=False, allow_blank=True)
    instance_of_p31 = serializers.CharField(required=False, allow_blank=True)
    instance_of_p31_label = serializers.CharField(required=False, allow_blank=True)
    instance_of_p31_wikipedia_url = serializers.URLField(required=False, allow_blank=True)
    architectural_style_p149 = serializers.CharField(required=False, allow_blank=True)
    architectural_style_p149_label = serializers.CharField(required=False, allow_blank=True)
    architectural_style_p149_wikipedia_url = serializers.URLField(required=False, allow_blank=True)
    route_instruction_p2795 = serializers.CharField(required=False, allow_blank=True)
    yso_id_p2347 = serializers.CharField(required=False, allow_blank=True)
    yle_topic_id_p8309 = serializers.CharField(required=False, allow_blank=True)
    kanto_id_p8980 = serializers.CharField(required=False, allow_blank=True)
    protected_buildings_register_in_finland_id_p5310 = serializers.CharField(required=False, allow_blank=True)
    rky_national_built_heritage_environment_id_p4009 = serializers.CharField(required=False, allow_blank=True)
    permanent_building_number_vtj_prt_p3824 = serializers.CharField(required=False, allow_blank=True)
    protected_buildings_register_in_finland_building_id_p5313 = serializers.CharField(required=False, allow_blank=True)
    helsinki_persistent_building_id_ratu_p8355 = serializers.CharField(required=False, allow_blank=True)
    commons_category = serializers.CharField(required=False, allow_blank=True)
    commons_category_url = serializers.URLField(required=False, allow_blank=True)
    commons_image_count_petscan = serializers.IntegerField(required=False, allow_null=True)
    view_it_qid = serializers.CharField(required=False, allow_blank=True)
    view_it_url = serializers.URLField(required=False, allow_blank=True)
    view_it_image_count = serializers.IntegerField(required=False, allow_null=True)
    image_name = serializers.CharField(required=False, allow_blank=True)
    image_url = serializers.URLField(required=False, allow_blank=True)
    image_thumb_url = serializers.URLField(required=False, allow_blank=True)
    inception_p571 = serializers.CharField(required=False, allow_blank=True)
    location_p276 = serializers.CharField(required=False, allow_blank=True)
    location_p276_label = serializers.CharField(required=False, allow_blank=True)
    location_p276_wikipedia_url = serializers.URLField(required=False, allow_blank=True)
    architect_p84 = serializers.CharField(required=False, allow_blank=True)
    architect_p84_label = serializers.CharField(required=False, allow_blank=True)
    architect_p84_wikipedia_url = serializers.URLField(required=False, allow_blank=True)
    architect_p84_values = serializers.ListField(child=serializers.DictField(), required=False)
    collection_membership_source_url = serializers.URLField(required=False, allow_blank=True)
    collection_membership_source_urls = serializers.ListField(
        child=serializers.URLField(allow_blank=True),
        required=False,
    )
    collection_membership_sources = serializers.ListField(child=serializers.DictField(), required=False)
    official_closure_date_p3999 = serializers.CharField(required=False, allow_blank=True)
    state_of_use_p5817 = serializers.CharField(required=False, allow_blank=True)
    state_of_use_p5817_label = serializers.CharField(required=False, allow_blank=True)
    state_of_use_p5817_wikipedia_url = serializers.URLField(required=False, allow_blank=True)
    parent_uri = serializers.CharField(required=False, allow_blank=True)
    parent_id = serializers.CharField(required=False, allow_blank=True)
    children = serializers.ListField(child=serializers.DictField(), required=False)


class DraftLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DraftLocation
        fields = [
            'id',
            'name',
            'description',
            'location_type',
            'wikidata_item',
            'latitude',
            'longitude',
            'address_text',
            'postal_code',
            'municipality_p131',
            'commons_category',
            'parent_uri',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_parent_uri(self, value: str) -> str:
        return value.strip()

    def validate_latitude(self, value: float) -> float:
        if value < -90 or value > 90:
            raise serializers.ValidationError('Latitude must be between -90 and 90.')
        return value

    def validate_longitude(self, value: float) -> float:
        if value < -180 or value > 180:
            raise serializers.ValidationError('Longitude must be between -180 and 180.')
        return value


class AddExistingWikidataItemSerializer(serializers.Serializer):
    wikidata_item = serializers.CharField(max_length=32)
    source_url = serializers.URLField(max_length=500)
    source_title = serializers.CharField(max_length=500, required=False, allow_blank=True)
    source_title_language = serializers.CharField(max_length=12, required=False, allow_blank=True)
    source_author = serializers.CharField(max_length=500, required=False, allow_blank=True)
    source_publication_date = serializers.CharField(max_length=32, required=False, allow_blank=True)
    source_publisher_p123 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    source_published_in_p1433 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    source_language_of_work_p407 = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate_wikidata_item(self, value: str) -> str:
        qid = _normalize_wikidata_qid(value)
        if not qid:
            raise serializers.ValidationError('A valid Wikidata item id is required.')
        return qid

    def validate_source_title_language(self, value: str) -> str:
        raw_value = (value or '').strip().lower()
        if not raw_value:
            return ''
        if re.fullmatch(r'[a-z]{2,12}', raw_value):
            return raw_value
        raise serializers.ValidationError('source_title_language must be a valid language code.')

    def validate_source_publication_date(self, value: str) -> str:
        raw_value = (value or '').strip()
        if not raw_value:
            return ''
        if re.fullmatch(r'\d{4}(?:-\d{2}(?:-\d{2})?)?', raw_value):
            return raw_value
        raise serializers.ValidationError('source_publication_date must use YYYY or YYYY-MM or YYYY-MM-DD format.')

    def validate_source_publisher_p123(self, value: str) -> str:
        raw_value = (value or '').strip()
        if not raw_value:
            return ''
        qid = _normalize_wikidata_qid(raw_value)
        if not qid:
            raise serializers.ValidationError('source_publisher_p123 must be a valid Wikidata QID.')
        return qid

    def validate_source_published_in_p1433(self, value: str) -> str:
        raw_value = (value or '').strip()
        if not raw_value:
            return ''
        qid = _normalize_wikidata_qid(raw_value)
        if not qid:
            raise serializers.ValidationError('source_published_in_p1433 must be a valid Wikidata QID.')
        return qid

    def validate_source_language_of_work_p407(self, value: str) -> str:
        raw_value = (value or '').strip()
        if not raw_value:
            return ''
        qid = _normalize_wikidata_qid(raw_value)
        if not qid:
            raise serializers.ValidationError('source_language_of_work_p407 must be a valid Wikidata QID.')
        return qid


class CreateWikidataItemSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=250)
    label_language = serializers.CharField(max_length=12, required=False, allow_blank=True)
    description = serializers.CharField(max_length=500)
    description_language = serializers.CharField(max_length=12, required=False, allow_blank=True)
    instance_of_p31 = serializers.CharField(max_length=32)
    country_p17 = serializers.CharField(max_length=32)
    municipality_p131 = serializers.CharField(max_length=32)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    address_text_p6375 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    address_text_language_p6375 = serializers.CharField(max_length=12, required=False, allow_blank=True)
    postal_code_p281 = serializers.CharField(max_length=40, required=False, allow_blank=True)
    commons_category_p373 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    architect_p84 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    architect_source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    inception_p571 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    inception_source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    official_closure_date_p3999 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    official_closure_date_source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    heritage_designation_p1435 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    heritage_source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    architectural_style_p149 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    state_of_use_p5817 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    located_on_street_p669 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    house_number_p670 = serializers.CharField(max_length=64, required=False, allow_blank=True)
    route_instruction_p2795 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    route_instruction_language_p2795 = serializers.CharField(max_length=12, required=False, allow_blank=True)

    def _validate_qid(self, value: str, field_name: str) -> str:
        qid = _normalize_wikidata_qid(value)
        if not qid:
            raise serializers.ValidationError(f'{field_name} must be a valid Wikidata QID.')
        return qid

    def _validate_optional_qid(self, value: str, field_name: str) -> str:
        raw_value = (value or '').strip()
        if not raw_value:
            return ''
        return self._validate_qid(raw_value, field_name)

    def _validate_date_like(self, value: str, field_name: str) -> str:
        raw_value = (value or '').strip()
        if not raw_value:
            return ''
        if re.fullmatch(r'\d{4}(?:-\d{2}(?:-\d{2})?)?', raw_value):
            return raw_value
        raise serializers.ValidationError(f'{field_name} must use YYYY or YYYY-MM or YYYY-MM-DD format.')

    def _validate_optional_language(self, value: str, field_name: str) -> str:
        raw_value = (value or '').strip().lower()
        if not raw_value:
            return ''
        if re.fullmatch(r'[a-z]{2,12}', raw_value):
            return raw_value
        raise serializers.ValidationError(f'{field_name} must be a valid language code.')

    def validate_instance_of_p31(self, value: str) -> str:
        return self._validate_qid(value, 'instance_of_p31')

    def validate_label_language(self, value: str) -> str:
        return self._validate_optional_language(value, 'label_language')

    def validate_description_language(self, value: str) -> str:
        return self._validate_optional_language(value, 'description_language')

    def validate_country_p17(self, value: str) -> str:
        return self._validate_qid(value, 'country_p17')

    def validate_municipality_p131(self, value: str) -> str:
        return self._validate_qid(value, 'municipality_p131')

    def validate_architect_p84(self, value: str) -> str:
        return self._validate_optional_qid(value, 'architect_p84')

    def validate_heritage_designation_p1435(self, value: str) -> str:
        return self._validate_optional_qid(value, 'heritage_designation_p1435')

    def validate_architectural_style_p149(self, value: str) -> str:
        return self._validate_optional_qid(value, 'architectural_style_p149')

    def validate_state_of_use_p5817(self, value: str) -> str:
        return self._validate_optional_qid(value, 'state_of_use_p5817')

    def validate_located_on_street_p669(self, value: str) -> str:
        return self._validate_optional_qid(value, 'located_on_street_p669')

    def validate_inception_p571(self, value: str) -> str:
        return self._validate_date_like(value, 'inception_p571')

    def validate_official_closure_date_p3999(self, value: str) -> str:
        return self._validate_date_like(value, 'official_closure_date_p3999')

    def validate_address_text_language_p6375(self, value: str) -> str:
        return self._validate_optional_language(value, 'address_text_language_p6375')

    def validate_route_instruction_language_p2795(self, value: str) -> str:
        return self._validate_optional_language(value, 'route_instruction_language_p2795')

    def validate_latitude(self, value: float) -> float:
        if value < -90 or value > 90:
            raise serializers.ValidationError('Latitude must be between -90 and 90.')
        return value

    def validate_longitude(self, value: float) -> float:
        if value < -180 or value > 180:
            raise serializers.ValidationError('Longitude must be between -180 and 180.')
        return value

    def validate(self, attrs):
        architect = str(attrs.get('architect_p84') or '').strip()
        architect_source = str(attrs.get('architect_source_url') or '').strip()
        inception = str(attrs.get('inception_p571') or '').strip()
        inception_source = str(attrs.get('inception_source_url') or '').strip()
        closure_date = str(attrs.get('official_closure_date_p3999') or '').strip()
        closure_date_source = str(attrs.get('official_closure_date_source_url') or '').strip()
        heritage = str(attrs.get('heritage_designation_p1435') or '').strip()
        heritage_source = str(attrs.get('heritage_source_url') or '').strip()

        if architect and not architect_source:
            raise serializers.ValidationError({'architect_source_url': 'Source URL is required when architect is set.'})
        if inception and not inception_source:
            raise serializers.ValidationError({'inception_source_url': 'Source URL is required when inception is set.'})
        if closure_date and not closure_date_source:
            raise serializers.ValidationError(
                {'official_closure_date_source_url': 'Source URL is required when official closure date is set.'}
            )
        if heritage and not heritage_source:
            raise serializers.ValidationError({'heritage_source_url': 'Source URL is required when heritage status is set.'})

        return attrs
