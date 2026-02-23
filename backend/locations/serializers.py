import json
import math
import re
from datetime import date

from rest_framework import serializers

from .models import DraftLocation


_WIKIDATA_QID_PATTERN = re.compile(r'(Q\d+)', flags=re.IGNORECASE)
_WIKIDATA_PID_PATTERN = re.compile(r'(P\d+)', flags=re.IGNORECASE)
_DATE_LIKE_ISO_PATTERN = re.compile(r'(?P<year>\d{4})(?:-(?P<month>\d{2})(?:-(?P<day>\d{2}))?)?$')
_DATE_LIKE_FI_PATTERN = re.compile(r'(?P<day>\d{1,2})\.\s*(?P<month>\d{1,2})\.\s*(?P<year>\d{4})')


def _normalize_wikidata_qid(value: str) -> str:
    match = _WIKIDATA_QID_PATTERN.search((value or '').strip())
    if not match:
        return ''
    return match.group(1).upper()


def _normalize_wikidata_pid(value: str) -> str:
    match = _WIKIDATA_PID_PATTERN.search((value or '').strip())
    if not match:
        return ''
    return match.group(1).upper()


def _normalize_date_like_input(value: str, field_name: str) -> str:
    raw_value = (value or '').strip()
    if not raw_value:
        return ''

    iso_match = _DATE_LIKE_ISO_PATTERN.fullmatch(raw_value)
    if iso_match:
        parsed_year = int(iso_match.group('year'))
        if parsed_year < 1:
            raise serializers.ValidationError(f'{field_name} year must be greater than 0.')

        parsed_month = iso_match.group('month')
        parsed_day = iso_match.group('day')
        if parsed_month and not parsed_day:
            try:
                date(parsed_year, int(parsed_month), 1)
            except ValueError as exc:
                raise serializers.ValidationError(f'{field_name} has an invalid month value.') from exc
        elif parsed_month and parsed_day:
            try:
                date(parsed_year, int(parsed_month), int(parsed_day))
            except ValueError as exc:
                raise serializers.ValidationError(f'{field_name} has an invalid date value.') from exc
        return raw_value

    fi_match = _DATE_LIKE_FI_PATTERN.fullmatch(raw_value)
    if fi_match:
        parsed_year = int(fi_match.group('year'))
        parsed_month = int(fi_match.group('month'))
        parsed_day = int(fi_match.group('day'))
        try:
            parsed = date(parsed_year, parsed_month, parsed_day)
        except ValueError as exc:
            raise serializers.ValidationError(f'{field_name} has an invalid date value.') from exc
        return f'{parsed.year:04d}-{parsed.month:02d}-{parsed.day:02d}'

    raise serializers.ValidationError(
        f'{field_name} must use YYYY or YYYY-MM or YYYY-MM-DD or D.M.YYYY format.'
    )


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
        return _normalize_date_like_input(value, 'source_publication_date')

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


class CommonsImageUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    caption = serializers.CharField(max_length=500, required=False, allow_blank=True)
    caption_language = serializers.CharField(max_length=12, required=False, allow_blank=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    description_language = serializers.CharField(max_length=12, required=False, allow_blank=True)
    target_filename = serializers.CharField(max_length=255, required=False, allow_blank=True)
    author = serializers.CharField(max_length=255, required=False, allow_blank=True)
    source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    date_created = serializers.CharField(max_length=32, required=False, allow_blank=True)
    license_template = serializers.ChoiceField(
        choices=('Cc-by-sa-4.0', 'Cc-by-4.0', 'Cc-zero'),
        required=False,
        default='Cc-by-sa-4.0',
    )
    categories_json = serializers.CharField(required=False, allow_blank=True)
    depicts_json = serializers.CharField(required=False, allow_blank=True)
    coordinate_source = serializers.ChoiceField(
        choices=('map', 'exif'),
        required=False,
        default='map',
    )
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)
    heading = serializers.FloatField(required=False)
    elevation_meters = serializers.FloatField(required=False)
    wikidata_item = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate_caption_language(self, value: str) -> str:
        raw_value = (value or '').strip().lower()
        if not raw_value:
            return ''
        if re.fullmatch(r'[a-z]{2,12}', raw_value):
            return raw_value
        raise serializers.ValidationError('caption_language must be a valid language code.')

    def validate_description_language(self, value: str) -> str:
        raw_value = (value or '').strip().lower()
        if not raw_value:
            return ''
        if re.fullmatch(r'[a-z]{2,12}', raw_value):
            return raw_value
        raise serializers.ValidationError('description_language must be a valid language code.')

    def validate_target_filename(self, value: str) -> str:
        raw_value = str(value or '').strip()
        if not raw_value:
            return ''
        basename = raw_value.replace('\\', '/').split('/')[-1].strip()
        if not basename:
            raise serializers.ValidationError('target_filename must be a valid filename.')
        if ':' in basename:
            raise serializers.ValidationError('target_filename cannot contain colon (:).')
        if '\n' in basename or '\r' in basename:
            raise serializers.ValidationError('target_filename cannot contain newline characters.')
        return basename

    def validate_author(self, value: str) -> str:
        return str(value or '').strip()

    def validate_date_created(self, value: str) -> str:
        return _normalize_date_like_input(value, 'date_created')

    def validate_wikidata_item(self, value: str) -> str:
        raw_value = (value or '').strip()
        if not raw_value:
            return ''
        qid = _normalize_wikidata_qid(raw_value)
        if not qid:
            raise serializers.ValidationError('wikidata_item must be a valid Wikidata QID.')
        return qid

    def validate(self, attrs):
        coordinate_source = str(attrs.get('coordinate_source') or 'map').strip().lower()
        latitude = attrs.get('latitude')
        longitude = attrs.get('longitude')
        heading = attrs.get('heading')
        elevation_meters = attrs.get('elevation_meters')

        if coordinate_source == 'map':
            if latitude is None or longitude is None:
                raise serializers.ValidationError(
                    {'latitude': 'Latitude and longitude are required when coordinate_source is map.'}
                )
            if latitude < -90 or latitude > 90:
                raise serializers.ValidationError({'latitude': 'Latitude must be between -90 and 90.'})
            if longitude < -180 or longitude > 180:
                raise serializers.ValidationError({'longitude': 'Longitude must be between -180 and 180.'})
        else:
            attrs['latitude'] = None
            attrs['longitude'] = None

        if heading is None:
            attrs['heading'] = None
        else:
            normalized_heading = float(heading)
            if not math.isfinite(normalized_heading):
                raise serializers.ValidationError({'heading': 'Heading must be a finite number.'})
            normalized_heading = normalized_heading % 360.0
            if normalized_heading < 0:
                normalized_heading += 360.0
            attrs['heading'] = normalized_heading

        if elevation_meters is None:
            attrs['elevation_meters'] = None
        else:
            normalized_elevation = float(elevation_meters)
            if not math.isfinite(normalized_elevation):
                raise serializers.ValidationError({'elevation_meters': 'Elevation must be a finite number.'})
            attrs['elevation_meters'] = normalized_elevation

        raw_categories_json = str(attrs.pop('categories_json', '') or '').strip()
        categories: list[str] = []
        seen_categories: set[str] = set()
        if raw_categories_json:
            try:
                parsed_categories = json.loads(raw_categories_json)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError({'categories_json': 'Must be valid JSON list.'}) from exc
            if not isinstance(parsed_categories, list):
                raise serializers.ValidationError({'categories_json': 'Must be a JSON list.'})

            for index, raw_category in enumerate(parsed_categories):
                normalized = str(raw_category or '').strip()
                if not normalized:
                    continue
                normalized = re.sub(r'^category:\s*', '', normalized, flags=re.IGNORECASE).strip()
                normalized = re.sub(r'\s+', '_', normalized)
                if not normalized:
                    continue
                dedupe_key = normalized.lower()
                if dedupe_key in seen_categories:
                    continue
                if len(normalized) > 255:
                    raise serializers.ValidationError(
                        {'categories_json': f'Category at index {index} is too long.'}
                    )
                seen_categories.add(dedupe_key)
                categories.append(normalized)

        raw_depicts_json = str(attrs.pop('depicts_json', '') or '').strip()
        depicts: list[str] = []
        seen_depicts: set[str] = set()
        if raw_depicts_json:
            try:
                parsed_depicts = json.loads(raw_depicts_json)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError({'depicts_json': 'Must be valid JSON list.'}) from exc
            if not isinstance(parsed_depicts, list):
                raise serializers.ValidationError({'depicts_json': 'Must be a JSON list.'})

            for index, raw_depict in enumerate(parsed_depicts):
                qid = _normalize_wikidata_qid(str(raw_depict or ''))
                if not qid:
                    raise serializers.ValidationError(
                        {'depicts_json': f'Value at index {index} must be a valid Wikidata QID.'}
                    )
                dedupe_key = qid.lower()
                if dedupe_key in seen_depicts:
                    continue
                seen_depicts.add(dedupe_key)
                depicts.append(qid)

        attrs['categories'] = categories
        attrs['depicts'] = depicts
        return attrs


class CreateWikidataItemSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=250, required=False, allow_blank=True)
    label_language = serializers.CharField(max_length=12, required=False, allow_blank=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    description_language = serializers.CharField(max_length=12, required=False, allow_blank=True)
    labels = serializers.DictField(child=serializers.CharField(max_length=250, allow_blank=True), required=False)
    descriptions = serializers.DictField(child=serializers.CharField(max_length=500, allow_blank=True), required=False)
    instance_of_p31 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    instance_of_p31_values = serializers.ListField(child=serializers.CharField(max_length=32), required=False)
    country_p17 = serializers.CharField(max_length=32)
    municipality_p131 = serializers.CharField(max_length=32)
    part_of_p361 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    part_of_p361_values = serializers.ListField(child=serializers.CharField(max_length=32), required=False)
    location_p276 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    address_text_p6375 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    address_text_language_p6375 = serializers.CharField(max_length=12, required=False, allow_blank=True)
    postal_code_p281 = serializers.CharField(max_length=40, required=False, allow_blank=True)
    commons_category_p373 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    architect_p84 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    architect_p84_values = serializers.ListField(child=serializers.CharField(max_length=32), required=False)
    architect_source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    inception_p571 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    inception_source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    official_closure_date_p3999 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    official_closure_date_source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    heritage_designation_p1435 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    heritage_designation_p1435_values = serializers.ListField(child=serializers.CharField(max_length=32), required=False)
    heritage_source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    architectural_style_p149 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    state_of_use_p5817 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    located_on_street_p669 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    house_number_p670 = serializers.CharField(max_length=64, required=False, allow_blank=True)
    route_instruction_p2795 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    route_instruction_language_p2795 = serializers.CharField(max_length=12, required=False, allow_blank=True)
    custom_properties = serializers.ListField(child=serializers.DictField(), required=False)
    source_url = serializers.URLField(max_length=500)
    source_title = serializers.CharField(max_length=500, required=False, allow_blank=True)
    source_title_language = serializers.CharField(max_length=12, required=False, allow_blank=True)
    source_author = serializers.CharField(max_length=500, required=False, allow_blank=True)
    source_publication_date = serializers.CharField(max_length=32, required=False, allow_blank=True)
    source_publisher_p123 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    source_published_in_p1433 = serializers.CharField(max_length=32, required=False, allow_blank=True)
    source_language_of_work_p407 = serializers.CharField(max_length=32, required=False, allow_blank=True)

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

    def _validate_pid(self, value: str, field_name: str) -> str:
        pid = _normalize_wikidata_pid(value)
        if not pid:
            raise serializers.ValidationError(f'{field_name} must be a valid Wikidata property id.')
        return pid

    def _validate_optional_qid_list(self, values: list, field_name: str) -> list[str]:
        if not isinstance(values, list):
            raise serializers.ValidationError(f'{field_name} must be a list.')

        normalized_values: list[str] = []
        seen: set[str] = set()
        for raw_value in values:
            qid = self._validate_optional_qid(str(raw_value or ''), field_name)
            if not qid or qid in seen:
                continue
            seen.add(qid)
            normalized_values.append(qid)

        return normalized_values

    def _validate_date_like(self, value: str, field_name: str) -> str:
        return _normalize_date_like_input(value, field_name)

    def _validate_optional_language(self, value: str, field_name: str) -> str:
        raw_value = (value or '').strip().lower()
        if not raw_value:
            return ''
        if re.fullmatch(r'[a-z]{2,12}', raw_value):
            return raw_value
        raise serializers.ValidationError(f'{field_name} must be a valid language code.')

    def _validate_language_text_map(self, value: dict, field_name: str) -> dict[str, str]:
        if not isinstance(value, dict):
            raise serializers.ValidationError(f'{field_name} must be an object keyed by language code.')
        normalized: dict[str, str] = {}
        for raw_language, raw_text in value.items():
            language = str(raw_language or '').strip().lower()
            if not re.fullmatch(r'[a-z]{2,12}', language):
                raise serializers.ValidationError(f'{field_name} keys must be valid language codes.')
            text = str(raw_text or '').strip()
            if not text:
                continue
            normalized[language] = text
        return normalized

    def validate_instance_of_p31(self, value: str) -> str:
        return self._validate_optional_qid(value, 'instance_of_p31')

    def validate_instance_of_p31_values(self, value: list) -> list[str]:
        return self._validate_optional_qid_list(value, 'instance_of_p31_values')

    def validate_label_language(self, value: str) -> str:
        return self._validate_optional_language(value, 'label_language')

    def validate_description_language(self, value: str) -> str:
        return self._validate_optional_language(value, 'description_language')

    def validate_labels(self, value: dict) -> dict[str, str]:
        return self._validate_language_text_map(value, 'labels')

    def validate_descriptions(self, value: dict) -> dict[str, str]:
        return self._validate_language_text_map(value, 'descriptions')

    def validate_country_p17(self, value: str) -> str:
        return self._validate_qid(value, 'country_p17')

    def validate_municipality_p131(self, value: str) -> str:
        return self._validate_qid(value, 'municipality_p131')

    def validate_part_of_p361(self, value: str) -> str:
        return self._validate_optional_qid(value, 'part_of_p361')

    def validate_part_of_p361_values(self, value: list) -> list[str]:
        return self._validate_optional_qid_list(value, 'part_of_p361_values')

    def validate_location_p276(self, value: str) -> str:
        return self._validate_optional_qid(value, 'location_p276')

    def validate_architect_p84(self, value: str) -> str:
        return self._validate_optional_qid(value, 'architect_p84')

    def validate_architect_p84_values(self, value: list) -> list[str]:
        return self._validate_optional_qid_list(value, 'architect_p84_values')

    def validate_heritage_designation_p1435(self, value: str) -> str:
        return self._validate_optional_qid(value, 'heritage_designation_p1435')

    def validate_heritage_designation_p1435_values(self, value: list) -> list[str]:
        return self._validate_optional_qid_list(value, 'heritage_designation_p1435_values')

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

    def validate_custom_properties(self, value: list) -> list[dict[str, str]]:
        if not isinstance(value, list):
            raise serializers.ValidationError('custom_properties must be a list.')

        normalized_entries: list[dict[str, str]] = []
        seen_entries: set[tuple[str, str, str]] = set()
        for index, raw_entry in enumerate(value):
            if not isinstance(raw_entry, dict):
                raise serializers.ValidationError(f'custom_properties[{index}] must be an object.')

            property_id = self._validate_pid(
                str(raw_entry.get('property_id') or raw_entry.get('propertyId') or ''),
                f'custom_properties[{index}].property_id',
            )
            property_value = str(raw_entry.get('value') or '').strip()
            if not property_value:
                continue
            datatype = str(raw_entry.get('datatype') or '').strip().lower()
            if datatype and not re.fullmatch(r'[a-z0-9-]{2,64}', datatype):
                raise serializers.ValidationError(f'custom_properties[{index}].datatype has an invalid format.')

            unique_key = (property_id, property_value, datatype)
            if unique_key in seen_entries:
                continue
            seen_entries.add(unique_key)
            normalized_entries.append(
                {
                    'property_id': property_id,
                    'value': property_value,
                    'datatype': datatype,
                }
            )

        return normalized_entries

    def validate_source_title_language(self, value: str) -> str:
        return self._validate_optional_language(value, 'source_title_language')

    def validate_source_publication_date(self, value: str) -> str:
        return self._validate_date_like(value, 'source_publication_date')

    def validate_source_publisher_p123(self, value: str) -> str:
        return self._validate_optional_qid(value, 'source_publisher_p123')

    def validate_source_published_in_p1433(self, value: str) -> str:
        return self._validate_optional_qid(value, 'source_published_in_p1433')

    def validate_source_language_of_work_p407(self, value: str) -> str:
        return self._validate_optional_qid(value, 'source_language_of_work_p407')

    def validate_latitude(self, value: float) -> float:
        if value < -90 or value > 90:
            raise serializers.ValidationError('Latitude must be between -90 and 90.')
        return value

    def validate_longitude(self, value: float) -> float:
        if value < -180 or value > 180:
            raise serializers.ValidationError('Longitude must be between -180 and 180.')
        return value

    def validate(self, attrs):
        def _merge_qid_values(single_value: str, values: list[str]) -> list[str]:
            merged_values: list[str] = []
            seen: set[str] = set()
            for raw_value in [single_value, *(values or [])]:
                normalized = str(raw_value or '').strip().upper()
                if not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                merged_values.append(normalized)
            return merged_values

        labels = dict(attrs.get('labels') or {})
        descriptions = dict(attrs.get('descriptions') or {})
        legacy_label = str(attrs.get('label') or '').strip()
        legacy_label_language = str(attrs.get('label_language') or '').strip().lower() or 'en'
        legacy_description = str(attrs.get('description') or '').strip()
        legacy_description_language = str(attrs.get('description_language') or '').strip().lower() or 'en'
        if legacy_label:
            labels[legacy_label_language] = legacy_label
        if legacy_description:
            descriptions[legacy_description_language] = legacy_description

        if not set(labels).intersection(descriptions):
            raise serializers.ValidationError(
                {'non_field_errors': ['At least one label/description language pair is required.']}
            )

        attrs['labels'] = labels
        attrs['descriptions'] = descriptions

        instance_values = _merge_qid_values(
            str(attrs.get('instance_of_p31') or ''),
            list(attrs.get('instance_of_p31_values') or []),
        )
        if not instance_values:
            raise serializers.ValidationError({'instance_of_p31': 'At least one instance_of_p31 value is required.'})
        attrs['instance_of_p31_values'] = instance_values
        attrs['instance_of_p31'] = instance_values[0]

        part_of_values = _merge_qid_values(
            str(attrs.get('part_of_p361') or ''),
            list(attrs.get('part_of_p361_values') or []),
        )
        attrs['part_of_p361_values'] = part_of_values
        attrs['part_of_p361'] = part_of_values[0] if part_of_values else ''

        architect_values = _merge_qid_values(
            str(attrs.get('architect_p84') or ''),
            list(attrs.get('architect_p84_values') or []),
        )
        attrs['architect_p84_values'] = architect_values
        attrs['architect_p84'] = architect_values[0] if architect_values else ''

        heritage_values = _merge_qid_values(
            str(attrs.get('heritage_designation_p1435') or ''),
            list(attrs.get('heritage_designation_p1435_values') or []),
        )
        attrs['heritage_designation_p1435_values'] = heritage_values
        attrs['heritage_designation_p1435'] = heritage_values[0] if heritage_values else ''

        architect = str(attrs.get('architect_p84') or '').strip()
        architect_source = str(attrs.get('architect_source_url') or '').strip()
        inception = str(attrs.get('inception_p571') or '').strip()
        inception_source = str(attrs.get('inception_source_url') or '').strip()
        closure_date = str(attrs.get('official_closure_date_p3999') or '').strip()
        closure_date_source = str(attrs.get('official_closure_date_source_url') or '').strip()
        source_url = str(attrs.get('source_url') or '').strip()
        heritage = str(attrs.get('heritage_designation_p1435') or '').strip()
        heritage_source = str(attrs.get('heritage_source_url') or '').strip() or source_url

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
        if heritage_source:
            attrs['heritage_source_url'] = heritage_source

        return attrs
