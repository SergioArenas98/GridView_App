// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gridview_database.dart';

// ignore_for_file: type=lint
class $SeasonsTable extends Seasons with TableInfo<$SeasonsTable, SeasonRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SeasonsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _yearMeta = const VerificationMeta('year');
  @override
  late final GeneratedColumn<int> year = GeneratedColumn<int>(
    'year',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _labelMeta = const VerificationMeta('label');
  @override
  late final GeneratedColumn<String> label = GeneratedColumn<String>(
    'label',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _startDateMeta = const VerificationMeta(
    'startDate',
  );
  @override
  late final GeneratedColumn<String> startDate = GeneratedColumn<String>(
    'start_date',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _endDateMeta = const VerificationMeta(
    'endDate',
  );
  @override
  late final GeneratedColumn<String> endDate = GeneratedColumn<String>(
    'end_date',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _roundCountMeta = const VerificationMeta(
    'roundCount',
  );
  @override
  late final GeneratedColumn<int> roundCount = GeneratedColumn<int>(
    'round_count',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _currentRoundMeta = const VerificationMeta(
    'currentRound',
  );
  @override
  late final GeneratedColumn<int> currentRound = GeneratedColumn<int>(
    'current_round',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isCurrentMeta = const VerificationMeta(
    'isCurrent',
  );
  @override
  late final GeneratedColumn<bool> isCurrent = GeneratedColumn<bool>(
    'is_current',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_current" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    year,
    label,
    status,
    startDate,
    endDate,
    roundCount,
    currentRound,
    isCurrent,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'seasons';
  @override
  VerificationContext validateIntegrity(
    Insertable<SeasonRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('year')) {
      context.handle(
        _yearMeta,
        year.isAcceptableOrUnknown(data['year']!, _yearMeta),
      );
    }
    if (data.containsKey('label')) {
      context.handle(
        _labelMeta,
        label.isAcceptableOrUnknown(data['label']!, _labelMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('start_date')) {
      context.handle(
        _startDateMeta,
        startDate.isAcceptableOrUnknown(data['start_date']!, _startDateMeta),
      );
    }
    if (data.containsKey('end_date')) {
      context.handle(
        _endDateMeta,
        endDate.isAcceptableOrUnknown(data['end_date']!, _endDateMeta),
      );
    }
    if (data.containsKey('round_count')) {
      context.handle(
        _roundCountMeta,
        roundCount.isAcceptableOrUnknown(data['round_count']!, _roundCountMeta),
      );
    }
    if (data.containsKey('current_round')) {
      context.handle(
        _currentRoundMeta,
        currentRound.isAcceptableOrUnknown(
          data['current_round']!,
          _currentRoundMeta,
        ),
      );
    }
    if (data.containsKey('is_current')) {
      context.handle(
        _isCurrentMeta,
        isCurrent.isAcceptableOrUnknown(data['is_current']!, _isCurrentMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {year};
  @override
  SeasonRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SeasonRow(
      year: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}year'],
      )!,
      label: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}label'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      startDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}start_date'],
      ),
      endDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}end_date'],
      ),
      roundCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}round_count'],
      ),
      currentRound: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}current_round'],
      ),
      isCurrent: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_current'],
      )!,
    );
  }

  @override
  $SeasonsTable createAlias(String alias) {
    return $SeasonsTable(attachedDatabase, alias);
  }
}

class SeasonRow extends DataClass implements Insertable<SeasonRow> {
  final int year;
  final String? label;

  /// `SeasonStatus` wire token.
  final String status;
  final String? startDate;
  final String? endDate;
  final int? roundCount;
  final int? currentRound;
  final bool isCurrent;
  const SeasonRow({
    required this.year,
    this.label,
    required this.status,
    this.startDate,
    this.endDate,
    this.roundCount,
    this.currentRound,
    required this.isCurrent,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['year'] = Variable<int>(year);
    if (!nullToAbsent || label != null) {
      map['label'] = Variable<String>(label);
    }
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || startDate != null) {
      map['start_date'] = Variable<String>(startDate);
    }
    if (!nullToAbsent || endDate != null) {
      map['end_date'] = Variable<String>(endDate);
    }
    if (!nullToAbsent || roundCount != null) {
      map['round_count'] = Variable<int>(roundCount);
    }
    if (!nullToAbsent || currentRound != null) {
      map['current_round'] = Variable<int>(currentRound);
    }
    map['is_current'] = Variable<bool>(isCurrent);
    return map;
  }

  SeasonsCompanion toCompanion(bool nullToAbsent) {
    return SeasonsCompanion(
      year: Value(year),
      label: label == null && nullToAbsent
          ? const Value.absent()
          : Value(label),
      status: Value(status),
      startDate: startDate == null && nullToAbsent
          ? const Value.absent()
          : Value(startDate),
      endDate: endDate == null && nullToAbsent
          ? const Value.absent()
          : Value(endDate),
      roundCount: roundCount == null && nullToAbsent
          ? const Value.absent()
          : Value(roundCount),
      currentRound: currentRound == null && nullToAbsent
          ? const Value.absent()
          : Value(currentRound),
      isCurrent: Value(isCurrent),
    );
  }

  factory SeasonRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SeasonRow(
      year: serializer.fromJson<int>(json['year']),
      label: serializer.fromJson<String?>(json['label']),
      status: serializer.fromJson<String>(json['status']),
      startDate: serializer.fromJson<String?>(json['startDate']),
      endDate: serializer.fromJson<String?>(json['endDate']),
      roundCount: serializer.fromJson<int?>(json['roundCount']),
      currentRound: serializer.fromJson<int?>(json['currentRound']),
      isCurrent: serializer.fromJson<bool>(json['isCurrent']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'year': serializer.toJson<int>(year),
      'label': serializer.toJson<String?>(label),
      'status': serializer.toJson<String>(status),
      'startDate': serializer.toJson<String?>(startDate),
      'endDate': serializer.toJson<String?>(endDate),
      'roundCount': serializer.toJson<int?>(roundCount),
      'currentRound': serializer.toJson<int?>(currentRound),
      'isCurrent': serializer.toJson<bool>(isCurrent),
    };
  }

  SeasonRow copyWith({
    int? year,
    Value<String?> label = const Value.absent(),
    String? status,
    Value<String?> startDate = const Value.absent(),
    Value<String?> endDate = const Value.absent(),
    Value<int?> roundCount = const Value.absent(),
    Value<int?> currentRound = const Value.absent(),
    bool? isCurrent,
  }) => SeasonRow(
    year: year ?? this.year,
    label: label.present ? label.value : this.label,
    status: status ?? this.status,
    startDate: startDate.present ? startDate.value : this.startDate,
    endDate: endDate.present ? endDate.value : this.endDate,
    roundCount: roundCount.present ? roundCount.value : this.roundCount,
    currentRound: currentRound.present ? currentRound.value : this.currentRound,
    isCurrent: isCurrent ?? this.isCurrent,
  );
  SeasonRow copyWithCompanion(SeasonsCompanion data) {
    return SeasonRow(
      year: data.year.present ? data.year.value : this.year,
      label: data.label.present ? data.label.value : this.label,
      status: data.status.present ? data.status.value : this.status,
      startDate: data.startDate.present ? data.startDate.value : this.startDate,
      endDate: data.endDate.present ? data.endDate.value : this.endDate,
      roundCount: data.roundCount.present
          ? data.roundCount.value
          : this.roundCount,
      currentRound: data.currentRound.present
          ? data.currentRound.value
          : this.currentRound,
      isCurrent: data.isCurrent.present ? data.isCurrent.value : this.isCurrent,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SeasonRow(')
          ..write('year: $year, ')
          ..write('label: $label, ')
          ..write('status: $status, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('roundCount: $roundCount, ')
          ..write('currentRound: $currentRound, ')
          ..write('isCurrent: $isCurrent')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    year,
    label,
    status,
    startDate,
    endDate,
    roundCount,
    currentRound,
    isCurrent,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SeasonRow &&
          other.year == this.year &&
          other.label == this.label &&
          other.status == this.status &&
          other.startDate == this.startDate &&
          other.endDate == this.endDate &&
          other.roundCount == this.roundCount &&
          other.currentRound == this.currentRound &&
          other.isCurrent == this.isCurrent);
}

class SeasonsCompanion extends UpdateCompanion<SeasonRow> {
  final Value<int> year;
  final Value<String?> label;
  final Value<String> status;
  final Value<String?> startDate;
  final Value<String?> endDate;
  final Value<int?> roundCount;
  final Value<int?> currentRound;
  final Value<bool> isCurrent;
  const SeasonsCompanion({
    this.year = const Value.absent(),
    this.label = const Value.absent(),
    this.status = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.roundCount = const Value.absent(),
    this.currentRound = const Value.absent(),
    this.isCurrent = const Value.absent(),
  });
  SeasonsCompanion.insert({
    this.year = const Value.absent(),
    this.label = const Value.absent(),
    required String status,
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.roundCount = const Value.absent(),
    this.currentRound = const Value.absent(),
    this.isCurrent = const Value.absent(),
  }) : status = Value(status);
  static Insertable<SeasonRow> custom({
    Expression<int>? year,
    Expression<String>? label,
    Expression<String>? status,
    Expression<String>? startDate,
    Expression<String>? endDate,
    Expression<int>? roundCount,
    Expression<int>? currentRound,
    Expression<bool>? isCurrent,
  }) {
    return RawValuesInsertable({
      if (year != null) 'year': year,
      if (label != null) 'label': label,
      if (status != null) 'status': status,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (roundCount != null) 'round_count': roundCount,
      if (currentRound != null) 'current_round': currentRound,
      if (isCurrent != null) 'is_current': isCurrent,
    });
  }

  SeasonsCompanion copyWith({
    Value<int>? year,
    Value<String?>? label,
    Value<String>? status,
    Value<String?>? startDate,
    Value<String?>? endDate,
    Value<int?>? roundCount,
    Value<int?>? currentRound,
    Value<bool>? isCurrent,
  }) {
    return SeasonsCompanion(
      year: year ?? this.year,
      label: label ?? this.label,
      status: status ?? this.status,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      roundCount: roundCount ?? this.roundCount,
      currentRound: currentRound ?? this.currentRound,
      isCurrent: isCurrent ?? this.isCurrent,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (year.present) {
      map['year'] = Variable<int>(year.value);
    }
    if (label.present) {
      map['label'] = Variable<String>(label.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (startDate.present) {
      map['start_date'] = Variable<String>(startDate.value);
    }
    if (endDate.present) {
      map['end_date'] = Variable<String>(endDate.value);
    }
    if (roundCount.present) {
      map['round_count'] = Variable<int>(roundCount.value);
    }
    if (currentRound.present) {
      map['current_round'] = Variable<int>(currentRound.value);
    }
    if (isCurrent.present) {
      map['is_current'] = Variable<bool>(isCurrent.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SeasonsCompanion(')
          ..write('year: $year, ')
          ..write('label: $label, ')
          ..write('status: $status, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('roundCount: $roundCount, ')
          ..write('currentRound: $currentRound, ')
          ..write('isCurrent: $isCurrent')
          ..write(')'))
        .toString();
  }
}

class $CircuitsTable extends Circuits
    with TableInfo<$CircuitsTable, CircuitRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CircuitsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _localityMeta = const VerificationMeta(
    'locality',
  );
  @override
  late final GeneratedColumn<String> locality = GeneratedColumn<String>(
    'locality',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _countryMeta = const VerificationMeta(
    'country',
  );
  @override
  late final GeneratedColumn<String> country = GeneratedColumn<String>(
    'country',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _countryCodeMeta = const VerificationMeta(
    'countryCode',
  );
  @override
  late final GeneratedColumn<String> countryCode = GeneratedColumn<String>(
    'country_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _latitudeMeta = const VerificationMeta(
    'latitude',
  );
  @override
  late final GeneratedColumn<double> latitude = GeneratedColumn<double>(
    'latitude',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _longitudeMeta = const VerificationMeta(
    'longitude',
  );
  @override
  late final GeneratedColumn<double> longitude = GeneratedColumn<double>(
    'longitude',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lengthMetersMeta = const VerificationMeta(
    'lengthMeters',
  );
  @override
  late final GeneratedColumn<int> lengthMeters = GeneratedColumn<int>(
    'length_meters',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _cornerCountMeta = const VerificationMeta(
    'cornerCount',
  );
  @override
  late final GeneratedColumn<int> cornerCount = GeneratedColumn<int>(
    'corner_count',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _directionMeta = const VerificationMeta(
    'direction',
  );
  @override
  late final GeneratedColumn<String> direction = GeneratedColumn<String>(
    'direction',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _firstGrandPrixYearMeta =
      const VerificationMeta('firstGrandPrixYear');
  @override
  late final GeneratedColumn<int> firstGrandPrixYear = GeneratedColumn<int>(
    'first_grand_prix_year',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lapRecordDriverIdMeta = const VerificationMeta(
    'lapRecordDriverId',
  );
  @override
  late final GeneratedColumn<String> lapRecordDriverId =
      GeneratedColumn<String>(
        'lap_record_driver_id',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _lapRecordTimeMillisMeta =
      const VerificationMeta('lapRecordTimeMillis');
  @override
  late final GeneratedColumn<int> lapRecordTimeMillis = GeneratedColumn<int>(
    'lap_record_time_millis',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lapRecordYearMeta = const VerificationMeta(
    'lapRecordYear',
  );
  @override
  late final GeneratedColumn<int> lapRecordYear = GeneratedColumn<int>(
    'lap_record_year',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    name,
    locality,
    country,
    countryCode,
    latitude,
    longitude,
    lengthMeters,
    cornerCount,
    direction,
    firstGrandPrixYear,
    lapRecordDriverId,
    lapRecordTimeMillis,
    lapRecordYear,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'circuits';
  @override
  VerificationContext validateIntegrity(
    Insertable<CircuitRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('locality')) {
      context.handle(
        _localityMeta,
        locality.isAcceptableOrUnknown(data['locality']!, _localityMeta),
      );
    }
    if (data.containsKey('country')) {
      context.handle(
        _countryMeta,
        country.isAcceptableOrUnknown(data['country']!, _countryMeta),
      );
    }
    if (data.containsKey('country_code')) {
      context.handle(
        _countryCodeMeta,
        countryCode.isAcceptableOrUnknown(
          data['country_code']!,
          _countryCodeMeta,
        ),
      );
    }
    if (data.containsKey('latitude')) {
      context.handle(
        _latitudeMeta,
        latitude.isAcceptableOrUnknown(data['latitude']!, _latitudeMeta),
      );
    }
    if (data.containsKey('longitude')) {
      context.handle(
        _longitudeMeta,
        longitude.isAcceptableOrUnknown(data['longitude']!, _longitudeMeta),
      );
    }
    if (data.containsKey('length_meters')) {
      context.handle(
        _lengthMetersMeta,
        lengthMeters.isAcceptableOrUnknown(
          data['length_meters']!,
          _lengthMetersMeta,
        ),
      );
    }
    if (data.containsKey('corner_count')) {
      context.handle(
        _cornerCountMeta,
        cornerCount.isAcceptableOrUnknown(
          data['corner_count']!,
          _cornerCountMeta,
        ),
      );
    }
    if (data.containsKey('direction')) {
      context.handle(
        _directionMeta,
        direction.isAcceptableOrUnknown(data['direction']!, _directionMeta),
      );
    }
    if (data.containsKey('first_grand_prix_year')) {
      context.handle(
        _firstGrandPrixYearMeta,
        firstGrandPrixYear.isAcceptableOrUnknown(
          data['first_grand_prix_year']!,
          _firstGrandPrixYearMeta,
        ),
      );
    }
    if (data.containsKey('lap_record_driver_id')) {
      context.handle(
        _lapRecordDriverIdMeta,
        lapRecordDriverId.isAcceptableOrUnknown(
          data['lap_record_driver_id']!,
          _lapRecordDriverIdMeta,
        ),
      );
    }
    if (data.containsKey('lap_record_time_millis')) {
      context.handle(
        _lapRecordTimeMillisMeta,
        lapRecordTimeMillis.isAcceptableOrUnknown(
          data['lap_record_time_millis']!,
          _lapRecordTimeMillisMeta,
        ),
      );
    }
    if (data.containsKey('lap_record_year')) {
      context.handle(
        _lapRecordYearMeta,
        lapRecordYear.isAcceptableOrUnknown(
          data['lap_record_year']!,
          _lapRecordYearMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CircuitRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CircuitRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      locality: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}locality'],
      ),
      country: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}country'],
      ),
      countryCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}country_code'],
      ),
      latitude: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}latitude'],
      ),
      longitude: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}longitude'],
      ),
      lengthMeters: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}length_meters'],
      ),
      cornerCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}corner_count'],
      ),
      direction: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}direction'],
      ),
      firstGrandPrixYear: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}first_grand_prix_year'],
      ),
      lapRecordDriverId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}lap_record_driver_id'],
      ),
      lapRecordTimeMillis: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}lap_record_time_millis'],
      ),
      lapRecordYear: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}lap_record_year'],
      ),
    );
  }

  @override
  $CircuitsTable createAlias(String alias) {
    return $CircuitsTable(attachedDatabase, alias);
  }
}

class CircuitRow extends DataClass implements Insertable<CircuitRow> {
  final String id;
  final String name;
  final String? locality;
  final String? country;

  /// ISO 3166-1 alpha-2, uppercase (approved rule).
  final String? countryCode;

  /// Decimal degrees.
  final double? latitude;
  final double? longitude;

  /// Lap length in metres (integer, field name states the unit).
  final int? lengthMeters;
  final int? cornerCount;

  /// `CircuitDirection` wire token (`clockwise`/`counter_clockwise`).
  final String? direction;
  final int? firstGrandPrixYear;

  /// Optional historical lap record, flattened from the domain `LapRecord`
  /// value object. The duration is stored as whole milliseconds.
  final String? lapRecordDriverId;
  final int? lapRecordTimeMillis;
  final int? lapRecordYear;
  const CircuitRow({
    required this.id,
    required this.name,
    this.locality,
    this.country,
    this.countryCode,
    this.latitude,
    this.longitude,
    this.lengthMeters,
    this.cornerCount,
    this.direction,
    this.firstGrandPrixYear,
    this.lapRecordDriverId,
    this.lapRecordTimeMillis,
    this.lapRecordYear,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || locality != null) {
      map['locality'] = Variable<String>(locality);
    }
    if (!nullToAbsent || country != null) {
      map['country'] = Variable<String>(country);
    }
    if (!nullToAbsent || countryCode != null) {
      map['country_code'] = Variable<String>(countryCode);
    }
    if (!nullToAbsent || latitude != null) {
      map['latitude'] = Variable<double>(latitude);
    }
    if (!nullToAbsent || longitude != null) {
      map['longitude'] = Variable<double>(longitude);
    }
    if (!nullToAbsent || lengthMeters != null) {
      map['length_meters'] = Variable<int>(lengthMeters);
    }
    if (!nullToAbsent || cornerCount != null) {
      map['corner_count'] = Variable<int>(cornerCount);
    }
    if (!nullToAbsent || direction != null) {
      map['direction'] = Variable<String>(direction);
    }
    if (!nullToAbsent || firstGrandPrixYear != null) {
      map['first_grand_prix_year'] = Variable<int>(firstGrandPrixYear);
    }
    if (!nullToAbsent || lapRecordDriverId != null) {
      map['lap_record_driver_id'] = Variable<String>(lapRecordDriverId);
    }
    if (!nullToAbsent || lapRecordTimeMillis != null) {
      map['lap_record_time_millis'] = Variable<int>(lapRecordTimeMillis);
    }
    if (!nullToAbsent || lapRecordYear != null) {
      map['lap_record_year'] = Variable<int>(lapRecordYear);
    }
    return map;
  }

  CircuitsCompanion toCompanion(bool nullToAbsent) {
    return CircuitsCompanion(
      id: Value(id),
      name: Value(name),
      locality: locality == null && nullToAbsent
          ? const Value.absent()
          : Value(locality),
      country: country == null && nullToAbsent
          ? const Value.absent()
          : Value(country),
      countryCode: countryCode == null && nullToAbsent
          ? const Value.absent()
          : Value(countryCode),
      latitude: latitude == null && nullToAbsent
          ? const Value.absent()
          : Value(latitude),
      longitude: longitude == null && nullToAbsent
          ? const Value.absent()
          : Value(longitude),
      lengthMeters: lengthMeters == null && nullToAbsent
          ? const Value.absent()
          : Value(lengthMeters),
      cornerCount: cornerCount == null && nullToAbsent
          ? const Value.absent()
          : Value(cornerCount),
      direction: direction == null && nullToAbsent
          ? const Value.absent()
          : Value(direction),
      firstGrandPrixYear: firstGrandPrixYear == null && nullToAbsent
          ? const Value.absent()
          : Value(firstGrandPrixYear),
      lapRecordDriverId: lapRecordDriverId == null && nullToAbsent
          ? const Value.absent()
          : Value(lapRecordDriverId),
      lapRecordTimeMillis: lapRecordTimeMillis == null && nullToAbsent
          ? const Value.absent()
          : Value(lapRecordTimeMillis),
      lapRecordYear: lapRecordYear == null && nullToAbsent
          ? const Value.absent()
          : Value(lapRecordYear),
    );
  }

  factory CircuitRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CircuitRow(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      locality: serializer.fromJson<String?>(json['locality']),
      country: serializer.fromJson<String?>(json['country']),
      countryCode: serializer.fromJson<String?>(json['countryCode']),
      latitude: serializer.fromJson<double?>(json['latitude']),
      longitude: serializer.fromJson<double?>(json['longitude']),
      lengthMeters: serializer.fromJson<int?>(json['lengthMeters']),
      cornerCount: serializer.fromJson<int?>(json['cornerCount']),
      direction: serializer.fromJson<String?>(json['direction']),
      firstGrandPrixYear: serializer.fromJson<int?>(json['firstGrandPrixYear']),
      lapRecordDriverId: serializer.fromJson<String?>(
        json['lapRecordDriverId'],
      ),
      lapRecordTimeMillis: serializer.fromJson<int?>(
        json['lapRecordTimeMillis'],
      ),
      lapRecordYear: serializer.fromJson<int?>(json['lapRecordYear']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'locality': serializer.toJson<String?>(locality),
      'country': serializer.toJson<String?>(country),
      'countryCode': serializer.toJson<String?>(countryCode),
      'latitude': serializer.toJson<double?>(latitude),
      'longitude': serializer.toJson<double?>(longitude),
      'lengthMeters': serializer.toJson<int?>(lengthMeters),
      'cornerCount': serializer.toJson<int?>(cornerCount),
      'direction': serializer.toJson<String?>(direction),
      'firstGrandPrixYear': serializer.toJson<int?>(firstGrandPrixYear),
      'lapRecordDriverId': serializer.toJson<String?>(lapRecordDriverId),
      'lapRecordTimeMillis': serializer.toJson<int?>(lapRecordTimeMillis),
      'lapRecordYear': serializer.toJson<int?>(lapRecordYear),
    };
  }

  CircuitRow copyWith({
    String? id,
    String? name,
    Value<String?> locality = const Value.absent(),
    Value<String?> country = const Value.absent(),
    Value<String?> countryCode = const Value.absent(),
    Value<double?> latitude = const Value.absent(),
    Value<double?> longitude = const Value.absent(),
    Value<int?> lengthMeters = const Value.absent(),
    Value<int?> cornerCount = const Value.absent(),
    Value<String?> direction = const Value.absent(),
    Value<int?> firstGrandPrixYear = const Value.absent(),
    Value<String?> lapRecordDriverId = const Value.absent(),
    Value<int?> lapRecordTimeMillis = const Value.absent(),
    Value<int?> lapRecordYear = const Value.absent(),
  }) => CircuitRow(
    id: id ?? this.id,
    name: name ?? this.name,
    locality: locality.present ? locality.value : this.locality,
    country: country.present ? country.value : this.country,
    countryCode: countryCode.present ? countryCode.value : this.countryCode,
    latitude: latitude.present ? latitude.value : this.latitude,
    longitude: longitude.present ? longitude.value : this.longitude,
    lengthMeters: lengthMeters.present ? lengthMeters.value : this.lengthMeters,
    cornerCount: cornerCount.present ? cornerCount.value : this.cornerCount,
    direction: direction.present ? direction.value : this.direction,
    firstGrandPrixYear: firstGrandPrixYear.present
        ? firstGrandPrixYear.value
        : this.firstGrandPrixYear,
    lapRecordDriverId: lapRecordDriverId.present
        ? lapRecordDriverId.value
        : this.lapRecordDriverId,
    lapRecordTimeMillis: lapRecordTimeMillis.present
        ? lapRecordTimeMillis.value
        : this.lapRecordTimeMillis,
    lapRecordYear: lapRecordYear.present
        ? lapRecordYear.value
        : this.lapRecordYear,
  );
  CircuitRow copyWithCompanion(CircuitsCompanion data) {
    return CircuitRow(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      locality: data.locality.present ? data.locality.value : this.locality,
      country: data.country.present ? data.country.value : this.country,
      countryCode: data.countryCode.present
          ? data.countryCode.value
          : this.countryCode,
      latitude: data.latitude.present ? data.latitude.value : this.latitude,
      longitude: data.longitude.present ? data.longitude.value : this.longitude,
      lengthMeters: data.lengthMeters.present
          ? data.lengthMeters.value
          : this.lengthMeters,
      cornerCount: data.cornerCount.present
          ? data.cornerCount.value
          : this.cornerCount,
      direction: data.direction.present ? data.direction.value : this.direction,
      firstGrandPrixYear: data.firstGrandPrixYear.present
          ? data.firstGrandPrixYear.value
          : this.firstGrandPrixYear,
      lapRecordDriverId: data.lapRecordDriverId.present
          ? data.lapRecordDriverId.value
          : this.lapRecordDriverId,
      lapRecordTimeMillis: data.lapRecordTimeMillis.present
          ? data.lapRecordTimeMillis.value
          : this.lapRecordTimeMillis,
      lapRecordYear: data.lapRecordYear.present
          ? data.lapRecordYear.value
          : this.lapRecordYear,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CircuitRow(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('locality: $locality, ')
          ..write('country: $country, ')
          ..write('countryCode: $countryCode, ')
          ..write('latitude: $latitude, ')
          ..write('longitude: $longitude, ')
          ..write('lengthMeters: $lengthMeters, ')
          ..write('cornerCount: $cornerCount, ')
          ..write('direction: $direction, ')
          ..write('firstGrandPrixYear: $firstGrandPrixYear, ')
          ..write('lapRecordDriverId: $lapRecordDriverId, ')
          ..write('lapRecordTimeMillis: $lapRecordTimeMillis, ')
          ..write('lapRecordYear: $lapRecordYear')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    name,
    locality,
    country,
    countryCode,
    latitude,
    longitude,
    lengthMeters,
    cornerCount,
    direction,
    firstGrandPrixYear,
    lapRecordDriverId,
    lapRecordTimeMillis,
    lapRecordYear,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CircuitRow &&
          other.id == this.id &&
          other.name == this.name &&
          other.locality == this.locality &&
          other.country == this.country &&
          other.countryCode == this.countryCode &&
          other.latitude == this.latitude &&
          other.longitude == this.longitude &&
          other.lengthMeters == this.lengthMeters &&
          other.cornerCount == this.cornerCount &&
          other.direction == this.direction &&
          other.firstGrandPrixYear == this.firstGrandPrixYear &&
          other.lapRecordDriverId == this.lapRecordDriverId &&
          other.lapRecordTimeMillis == this.lapRecordTimeMillis &&
          other.lapRecordYear == this.lapRecordYear);
}

class CircuitsCompanion extends UpdateCompanion<CircuitRow> {
  final Value<String> id;
  final Value<String> name;
  final Value<String?> locality;
  final Value<String?> country;
  final Value<String?> countryCode;
  final Value<double?> latitude;
  final Value<double?> longitude;
  final Value<int?> lengthMeters;
  final Value<int?> cornerCount;
  final Value<String?> direction;
  final Value<int?> firstGrandPrixYear;
  final Value<String?> lapRecordDriverId;
  final Value<int?> lapRecordTimeMillis;
  final Value<int?> lapRecordYear;
  final Value<int> rowid;
  const CircuitsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.locality = const Value.absent(),
    this.country = const Value.absent(),
    this.countryCode = const Value.absent(),
    this.latitude = const Value.absent(),
    this.longitude = const Value.absent(),
    this.lengthMeters = const Value.absent(),
    this.cornerCount = const Value.absent(),
    this.direction = const Value.absent(),
    this.firstGrandPrixYear = const Value.absent(),
    this.lapRecordDriverId = const Value.absent(),
    this.lapRecordTimeMillis = const Value.absent(),
    this.lapRecordYear = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CircuitsCompanion.insert({
    required String id,
    required String name,
    this.locality = const Value.absent(),
    this.country = const Value.absent(),
    this.countryCode = const Value.absent(),
    this.latitude = const Value.absent(),
    this.longitude = const Value.absent(),
    this.lengthMeters = const Value.absent(),
    this.cornerCount = const Value.absent(),
    this.direction = const Value.absent(),
    this.firstGrandPrixYear = const Value.absent(),
    this.lapRecordDriverId = const Value.absent(),
    this.lapRecordTimeMillis = const Value.absent(),
    this.lapRecordYear = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       name = Value(name);
  static Insertable<CircuitRow> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<String>? locality,
    Expression<String>? country,
    Expression<String>? countryCode,
    Expression<double>? latitude,
    Expression<double>? longitude,
    Expression<int>? lengthMeters,
    Expression<int>? cornerCount,
    Expression<String>? direction,
    Expression<int>? firstGrandPrixYear,
    Expression<String>? lapRecordDriverId,
    Expression<int>? lapRecordTimeMillis,
    Expression<int>? lapRecordYear,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (locality != null) 'locality': locality,
      if (country != null) 'country': country,
      if (countryCode != null) 'country_code': countryCode,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (lengthMeters != null) 'length_meters': lengthMeters,
      if (cornerCount != null) 'corner_count': cornerCount,
      if (direction != null) 'direction': direction,
      if (firstGrandPrixYear != null)
        'first_grand_prix_year': firstGrandPrixYear,
      if (lapRecordDriverId != null) 'lap_record_driver_id': lapRecordDriverId,
      if (lapRecordTimeMillis != null)
        'lap_record_time_millis': lapRecordTimeMillis,
      if (lapRecordYear != null) 'lap_record_year': lapRecordYear,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CircuitsCompanion copyWith({
    Value<String>? id,
    Value<String>? name,
    Value<String?>? locality,
    Value<String?>? country,
    Value<String?>? countryCode,
    Value<double?>? latitude,
    Value<double?>? longitude,
    Value<int?>? lengthMeters,
    Value<int?>? cornerCount,
    Value<String?>? direction,
    Value<int?>? firstGrandPrixYear,
    Value<String?>? lapRecordDriverId,
    Value<int?>? lapRecordTimeMillis,
    Value<int?>? lapRecordYear,
    Value<int>? rowid,
  }) {
    return CircuitsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      locality: locality ?? this.locality,
      country: country ?? this.country,
      countryCode: countryCode ?? this.countryCode,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      lengthMeters: lengthMeters ?? this.lengthMeters,
      cornerCount: cornerCount ?? this.cornerCount,
      direction: direction ?? this.direction,
      firstGrandPrixYear: firstGrandPrixYear ?? this.firstGrandPrixYear,
      lapRecordDriverId: lapRecordDriverId ?? this.lapRecordDriverId,
      lapRecordTimeMillis: lapRecordTimeMillis ?? this.lapRecordTimeMillis,
      lapRecordYear: lapRecordYear ?? this.lapRecordYear,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (locality.present) {
      map['locality'] = Variable<String>(locality.value);
    }
    if (country.present) {
      map['country'] = Variable<String>(country.value);
    }
    if (countryCode.present) {
      map['country_code'] = Variable<String>(countryCode.value);
    }
    if (latitude.present) {
      map['latitude'] = Variable<double>(latitude.value);
    }
    if (longitude.present) {
      map['longitude'] = Variable<double>(longitude.value);
    }
    if (lengthMeters.present) {
      map['length_meters'] = Variable<int>(lengthMeters.value);
    }
    if (cornerCount.present) {
      map['corner_count'] = Variable<int>(cornerCount.value);
    }
    if (direction.present) {
      map['direction'] = Variable<String>(direction.value);
    }
    if (firstGrandPrixYear.present) {
      map['first_grand_prix_year'] = Variable<int>(firstGrandPrixYear.value);
    }
    if (lapRecordDriverId.present) {
      map['lap_record_driver_id'] = Variable<String>(lapRecordDriverId.value);
    }
    if (lapRecordTimeMillis.present) {
      map['lap_record_time_millis'] = Variable<int>(lapRecordTimeMillis.value);
    }
    if (lapRecordYear.present) {
      map['lap_record_year'] = Variable<int>(lapRecordYear.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CircuitsCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('locality: $locality, ')
          ..write('country: $country, ')
          ..write('countryCode: $countryCode, ')
          ..write('latitude: $latitude, ')
          ..write('longitude: $longitude, ')
          ..write('lengthMeters: $lengthMeters, ')
          ..write('cornerCount: $cornerCount, ')
          ..write('direction: $direction, ')
          ..write('firstGrandPrixYear: $firstGrandPrixYear, ')
          ..write('lapRecordDriverId: $lapRecordDriverId, ')
          ..write('lapRecordTimeMillis: $lapRecordTimeMillis, ')
          ..write('lapRecordYear: $lapRecordYear, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $GrandPrixEventsTable extends GrandPrixEvents
    with TableInfo<$GrandPrixEventsTable, GrandPrixRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $GrandPrixEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _seasonMeta = const VerificationMeta('season');
  @override
  late final GeneratedColumn<int> season = GeneratedColumn<int>(
    'season',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES seasons (year) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _roundMeta = const VerificationMeta('round');
  @override
  late final GeneratedColumn<int> round = GeneratedColumn<int>(
    'round',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _eventSlugMeta = const VerificationMeta(
    'eventSlug',
  );
  @override
  late final GeneratedColumn<String> eventSlug = GeneratedColumn<String>(
    'event_slug',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _officialNameMeta = const VerificationMeta(
    'officialName',
  );
  @override
  late final GeneratedColumn<String> officialName = GeneratedColumn<String>(
    'official_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _circuitIdMeta = const VerificationMeta(
    'circuitId',
  );
  @override
  late final GeneratedColumn<String> circuitId = GeneratedColumn<String>(
    'circuit_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES circuits (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _formatMeta = const VerificationMeta('format');
  @override
  late final GeneratedColumn<String> format = GeneratedColumn<String>(
    'format',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _startDateMeta = const VerificationMeta(
    'startDate',
  );
  @override
  late final GeneratedColumn<String> startDate = GeneratedColumn<String>(
    'start_date',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _endDateMeta = const VerificationMeta(
    'endDate',
  );
  @override
  late final GeneratedColumn<String> endDate = GeneratedColumn<String>(
    'end_date',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _timezoneMeta = const VerificationMeta(
    'timezone',
  );
  @override
  late final GeneratedColumn<String> timezone = GeneratedColumn<String>(
    'timezone',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _hasResultsMeta = const VerificationMeta(
    'hasResults',
  );
  @override
  late final GeneratedColumn<bool> hasResults = GeneratedColumn<bool>(
    'has_results',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("has_results" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    season,
    round,
    eventSlug,
    name,
    officialName,
    circuitId,
    status,
    format,
    startDate,
    endDate,
    timezone,
    hasResults,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'grand_prix';
  @override
  VerificationContext validateIntegrity(
    Insertable<GrandPrixRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('season')) {
      context.handle(
        _seasonMeta,
        season.isAcceptableOrUnknown(data['season']!, _seasonMeta),
      );
    } else if (isInserting) {
      context.missing(_seasonMeta);
    }
    if (data.containsKey('round')) {
      context.handle(
        _roundMeta,
        round.isAcceptableOrUnknown(data['round']!, _roundMeta),
      );
    } else if (isInserting) {
      context.missing(_roundMeta);
    }
    if (data.containsKey('event_slug')) {
      context.handle(
        _eventSlugMeta,
        eventSlug.isAcceptableOrUnknown(data['event_slug']!, _eventSlugMeta),
      );
    } else if (isInserting) {
      context.missing(_eventSlugMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('official_name')) {
      context.handle(
        _officialNameMeta,
        officialName.isAcceptableOrUnknown(
          data['official_name']!,
          _officialNameMeta,
        ),
      );
    }
    if (data.containsKey('circuit_id')) {
      context.handle(
        _circuitIdMeta,
        circuitId.isAcceptableOrUnknown(data['circuit_id']!, _circuitIdMeta),
      );
    } else if (isInserting) {
      context.missing(_circuitIdMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('format')) {
      context.handle(
        _formatMeta,
        format.isAcceptableOrUnknown(data['format']!, _formatMeta),
      );
    } else if (isInserting) {
      context.missing(_formatMeta);
    }
    if (data.containsKey('start_date')) {
      context.handle(
        _startDateMeta,
        startDate.isAcceptableOrUnknown(data['start_date']!, _startDateMeta),
      );
    }
    if (data.containsKey('end_date')) {
      context.handle(
        _endDateMeta,
        endDate.isAcceptableOrUnknown(data['end_date']!, _endDateMeta),
      );
    }
    if (data.containsKey('timezone')) {
      context.handle(
        _timezoneMeta,
        timezone.isAcceptableOrUnknown(data['timezone']!, _timezoneMeta),
      );
    }
    if (data.containsKey('has_results')) {
      context.handle(
        _hasResultsMeta,
        hasResults.isAcceptableOrUnknown(data['has_results']!, _hasResultsMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  List<Set<GeneratedColumn>> get uniqueKeys => [
    {season, round},
  ];
  @override
  GrandPrixRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return GrandPrixRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      season: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}season'],
      )!,
      round: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}round'],
      )!,
      eventSlug: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}event_slug'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      officialName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}official_name'],
      ),
      circuitId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}circuit_id'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      format: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}format'],
      )!,
      startDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}start_date'],
      ),
      endDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}end_date'],
      ),
      timezone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}timezone'],
      ),
      hasResults: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}has_results'],
      )!,
    );
  }

  @override
  $GrandPrixEventsTable createAlias(String alias) {
    return $GrandPrixEventsTable(attachedDatabase, alias);
  }
}

class GrandPrixRow extends DataClass implements Insertable<GrandPrixRow> {
  final String id;
  final int season;
  final int round;
  final String eventSlug;
  final String name;
  final String? officialName;
  final String circuitId;

  /// `EventStatus` wire token.
  final String status;

  /// `WeekendFormat` wire token.
  final String format;

  /// Calendar-only local dates (no timezone conversion applied).
  final String? startDate;
  final String? endDate;

  /// Event-local IANA timezone (e.g. `Europe/Brussels`); distinct from any UTC
  /// instant and never derived from a country code.
  final String? timezone;
  final bool hasResults;
  const GrandPrixRow({
    required this.id,
    required this.season,
    required this.round,
    required this.eventSlug,
    required this.name,
    this.officialName,
    required this.circuitId,
    required this.status,
    required this.format,
    this.startDate,
    this.endDate,
    this.timezone,
    required this.hasResults,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['season'] = Variable<int>(season);
    map['round'] = Variable<int>(round);
    map['event_slug'] = Variable<String>(eventSlug);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || officialName != null) {
      map['official_name'] = Variable<String>(officialName);
    }
    map['circuit_id'] = Variable<String>(circuitId);
    map['status'] = Variable<String>(status);
    map['format'] = Variable<String>(format);
    if (!nullToAbsent || startDate != null) {
      map['start_date'] = Variable<String>(startDate);
    }
    if (!nullToAbsent || endDate != null) {
      map['end_date'] = Variable<String>(endDate);
    }
    if (!nullToAbsent || timezone != null) {
      map['timezone'] = Variable<String>(timezone);
    }
    map['has_results'] = Variable<bool>(hasResults);
    return map;
  }

  GrandPrixEventsCompanion toCompanion(bool nullToAbsent) {
    return GrandPrixEventsCompanion(
      id: Value(id),
      season: Value(season),
      round: Value(round),
      eventSlug: Value(eventSlug),
      name: Value(name),
      officialName: officialName == null && nullToAbsent
          ? const Value.absent()
          : Value(officialName),
      circuitId: Value(circuitId),
      status: Value(status),
      format: Value(format),
      startDate: startDate == null && nullToAbsent
          ? const Value.absent()
          : Value(startDate),
      endDate: endDate == null && nullToAbsent
          ? const Value.absent()
          : Value(endDate),
      timezone: timezone == null && nullToAbsent
          ? const Value.absent()
          : Value(timezone),
      hasResults: Value(hasResults),
    );
  }

  factory GrandPrixRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return GrandPrixRow(
      id: serializer.fromJson<String>(json['id']),
      season: serializer.fromJson<int>(json['season']),
      round: serializer.fromJson<int>(json['round']),
      eventSlug: serializer.fromJson<String>(json['eventSlug']),
      name: serializer.fromJson<String>(json['name']),
      officialName: serializer.fromJson<String?>(json['officialName']),
      circuitId: serializer.fromJson<String>(json['circuitId']),
      status: serializer.fromJson<String>(json['status']),
      format: serializer.fromJson<String>(json['format']),
      startDate: serializer.fromJson<String?>(json['startDate']),
      endDate: serializer.fromJson<String?>(json['endDate']),
      timezone: serializer.fromJson<String?>(json['timezone']),
      hasResults: serializer.fromJson<bool>(json['hasResults']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'season': serializer.toJson<int>(season),
      'round': serializer.toJson<int>(round),
      'eventSlug': serializer.toJson<String>(eventSlug),
      'name': serializer.toJson<String>(name),
      'officialName': serializer.toJson<String?>(officialName),
      'circuitId': serializer.toJson<String>(circuitId),
      'status': serializer.toJson<String>(status),
      'format': serializer.toJson<String>(format),
      'startDate': serializer.toJson<String?>(startDate),
      'endDate': serializer.toJson<String?>(endDate),
      'timezone': serializer.toJson<String?>(timezone),
      'hasResults': serializer.toJson<bool>(hasResults),
    };
  }

  GrandPrixRow copyWith({
    String? id,
    int? season,
    int? round,
    String? eventSlug,
    String? name,
    Value<String?> officialName = const Value.absent(),
    String? circuitId,
    String? status,
    String? format,
    Value<String?> startDate = const Value.absent(),
    Value<String?> endDate = const Value.absent(),
    Value<String?> timezone = const Value.absent(),
    bool? hasResults,
  }) => GrandPrixRow(
    id: id ?? this.id,
    season: season ?? this.season,
    round: round ?? this.round,
    eventSlug: eventSlug ?? this.eventSlug,
    name: name ?? this.name,
    officialName: officialName.present ? officialName.value : this.officialName,
    circuitId: circuitId ?? this.circuitId,
    status: status ?? this.status,
    format: format ?? this.format,
    startDate: startDate.present ? startDate.value : this.startDate,
    endDate: endDate.present ? endDate.value : this.endDate,
    timezone: timezone.present ? timezone.value : this.timezone,
    hasResults: hasResults ?? this.hasResults,
  );
  GrandPrixRow copyWithCompanion(GrandPrixEventsCompanion data) {
    return GrandPrixRow(
      id: data.id.present ? data.id.value : this.id,
      season: data.season.present ? data.season.value : this.season,
      round: data.round.present ? data.round.value : this.round,
      eventSlug: data.eventSlug.present ? data.eventSlug.value : this.eventSlug,
      name: data.name.present ? data.name.value : this.name,
      officialName: data.officialName.present
          ? data.officialName.value
          : this.officialName,
      circuitId: data.circuitId.present ? data.circuitId.value : this.circuitId,
      status: data.status.present ? data.status.value : this.status,
      format: data.format.present ? data.format.value : this.format,
      startDate: data.startDate.present ? data.startDate.value : this.startDate,
      endDate: data.endDate.present ? data.endDate.value : this.endDate,
      timezone: data.timezone.present ? data.timezone.value : this.timezone,
      hasResults: data.hasResults.present
          ? data.hasResults.value
          : this.hasResults,
    );
  }

  @override
  String toString() {
    return (StringBuffer('GrandPrixRow(')
          ..write('id: $id, ')
          ..write('season: $season, ')
          ..write('round: $round, ')
          ..write('eventSlug: $eventSlug, ')
          ..write('name: $name, ')
          ..write('officialName: $officialName, ')
          ..write('circuitId: $circuitId, ')
          ..write('status: $status, ')
          ..write('format: $format, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('timezone: $timezone, ')
          ..write('hasResults: $hasResults')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    season,
    round,
    eventSlug,
    name,
    officialName,
    circuitId,
    status,
    format,
    startDate,
    endDate,
    timezone,
    hasResults,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is GrandPrixRow &&
          other.id == this.id &&
          other.season == this.season &&
          other.round == this.round &&
          other.eventSlug == this.eventSlug &&
          other.name == this.name &&
          other.officialName == this.officialName &&
          other.circuitId == this.circuitId &&
          other.status == this.status &&
          other.format == this.format &&
          other.startDate == this.startDate &&
          other.endDate == this.endDate &&
          other.timezone == this.timezone &&
          other.hasResults == this.hasResults);
}

class GrandPrixEventsCompanion extends UpdateCompanion<GrandPrixRow> {
  final Value<String> id;
  final Value<int> season;
  final Value<int> round;
  final Value<String> eventSlug;
  final Value<String> name;
  final Value<String?> officialName;
  final Value<String> circuitId;
  final Value<String> status;
  final Value<String> format;
  final Value<String?> startDate;
  final Value<String?> endDate;
  final Value<String?> timezone;
  final Value<bool> hasResults;
  final Value<int> rowid;
  const GrandPrixEventsCompanion({
    this.id = const Value.absent(),
    this.season = const Value.absent(),
    this.round = const Value.absent(),
    this.eventSlug = const Value.absent(),
    this.name = const Value.absent(),
    this.officialName = const Value.absent(),
    this.circuitId = const Value.absent(),
    this.status = const Value.absent(),
    this.format = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.timezone = const Value.absent(),
    this.hasResults = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  GrandPrixEventsCompanion.insert({
    required String id,
    required int season,
    required int round,
    required String eventSlug,
    required String name,
    this.officialName = const Value.absent(),
    required String circuitId,
    required String status,
    required String format,
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.timezone = const Value.absent(),
    this.hasResults = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       season = Value(season),
       round = Value(round),
       eventSlug = Value(eventSlug),
       name = Value(name),
       circuitId = Value(circuitId),
       status = Value(status),
       format = Value(format);
  static Insertable<GrandPrixRow> custom({
    Expression<String>? id,
    Expression<int>? season,
    Expression<int>? round,
    Expression<String>? eventSlug,
    Expression<String>? name,
    Expression<String>? officialName,
    Expression<String>? circuitId,
    Expression<String>? status,
    Expression<String>? format,
    Expression<String>? startDate,
    Expression<String>? endDate,
    Expression<String>? timezone,
    Expression<bool>? hasResults,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (season != null) 'season': season,
      if (round != null) 'round': round,
      if (eventSlug != null) 'event_slug': eventSlug,
      if (name != null) 'name': name,
      if (officialName != null) 'official_name': officialName,
      if (circuitId != null) 'circuit_id': circuitId,
      if (status != null) 'status': status,
      if (format != null) 'format': format,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (timezone != null) 'timezone': timezone,
      if (hasResults != null) 'has_results': hasResults,
      if (rowid != null) 'rowid': rowid,
    });
  }

  GrandPrixEventsCompanion copyWith({
    Value<String>? id,
    Value<int>? season,
    Value<int>? round,
    Value<String>? eventSlug,
    Value<String>? name,
    Value<String?>? officialName,
    Value<String>? circuitId,
    Value<String>? status,
    Value<String>? format,
    Value<String?>? startDate,
    Value<String?>? endDate,
    Value<String?>? timezone,
    Value<bool>? hasResults,
    Value<int>? rowid,
  }) {
    return GrandPrixEventsCompanion(
      id: id ?? this.id,
      season: season ?? this.season,
      round: round ?? this.round,
      eventSlug: eventSlug ?? this.eventSlug,
      name: name ?? this.name,
      officialName: officialName ?? this.officialName,
      circuitId: circuitId ?? this.circuitId,
      status: status ?? this.status,
      format: format ?? this.format,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      timezone: timezone ?? this.timezone,
      hasResults: hasResults ?? this.hasResults,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (season.present) {
      map['season'] = Variable<int>(season.value);
    }
    if (round.present) {
      map['round'] = Variable<int>(round.value);
    }
    if (eventSlug.present) {
      map['event_slug'] = Variable<String>(eventSlug.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (officialName.present) {
      map['official_name'] = Variable<String>(officialName.value);
    }
    if (circuitId.present) {
      map['circuit_id'] = Variable<String>(circuitId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (format.present) {
      map['format'] = Variable<String>(format.value);
    }
    if (startDate.present) {
      map['start_date'] = Variable<String>(startDate.value);
    }
    if (endDate.present) {
      map['end_date'] = Variable<String>(endDate.value);
    }
    if (timezone.present) {
      map['timezone'] = Variable<String>(timezone.value);
    }
    if (hasResults.present) {
      map['has_results'] = Variable<bool>(hasResults.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('GrandPrixEventsCompanion(')
          ..write('id: $id, ')
          ..write('season: $season, ')
          ..write('round: $round, ')
          ..write('eventSlug: $eventSlug, ')
          ..write('name: $name, ')
          ..write('officialName: $officialName, ')
          ..write('circuitId: $circuitId, ')
          ..write('status: $status, ')
          ..write('format: $format, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('timezone: $timezone, ')
          ..write('hasResults: $hasResults, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SessionsTable extends Sessions
    with TableInfo<$SessionsTable, SessionRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SessionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _grandPrixIdMeta = const VerificationMeta(
    'grandPrixId',
  );
  @override
  late final GeneratedColumn<String> grandPrixId = GeneratedColumn<String>(
    'grand_prix_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES grand_prix (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _startTimeUtcMeta = const VerificationMeta(
    'startTimeUtc',
  );
  @override
  late final GeneratedColumn<DateTime> startTimeUtc = GeneratedColumn<DateTime>(
    'start_time_utc',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _endTimeUtcMeta = const VerificationMeta(
    'endTimeUtc',
  );
  @override
  late final GeneratedColumn<DateTime> endTimeUtc = GeneratedColumn<DateTime>(
    'end_time_utc',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _orderIndexMeta = const VerificationMeta(
    'orderIndex',
  );
  @override
  late final GeneratedColumn<int> orderIndex = GeneratedColumn<int>(
    'order_index',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    grandPrixId,
    type,
    name,
    startTimeUtc,
    endTimeUtc,
    status,
    orderIndex,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sessions';
  @override
  VerificationContext validateIntegrity(
    Insertable<SessionRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('grand_prix_id')) {
      context.handle(
        _grandPrixIdMeta,
        grandPrixId.isAcceptableOrUnknown(
          data['grand_prix_id']!,
          _grandPrixIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_grandPrixIdMeta);
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    }
    if (data.containsKey('start_time_utc')) {
      context.handle(
        _startTimeUtcMeta,
        startTimeUtc.isAcceptableOrUnknown(
          data['start_time_utc']!,
          _startTimeUtcMeta,
        ),
      );
    }
    if (data.containsKey('end_time_utc')) {
      context.handle(
        _endTimeUtcMeta,
        endTimeUtc.isAcceptableOrUnknown(
          data['end_time_utc']!,
          _endTimeUtcMeta,
        ),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('order_index')) {
      context.handle(
        _orderIndexMeta,
        orderIndex.isAcceptableOrUnknown(data['order_index']!, _orderIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIndexMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SessionRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SessionRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      grandPrixId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}grand_prix_id'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      ),
      startTimeUtc: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}start_time_utc'],
      ),
      endTimeUtc: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}end_time_utc'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      orderIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}order_index'],
      )!,
    );
  }

  @override
  $SessionsTable createAlias(String alias) {
    return $SessionsTable(attachedDatabase, alias);
  }
}

class SessionRow extends DataClass implements Insertable<SessionRow> {
  final String id;

  /// Cascades: removing a Grand Prix removes its sessions.
  final String grandPrixId;

  /// `SessionType` wire token.
  final String type;
  final String? name;

  /// UTC instants (stored as ISO-8601 text via `storeDateTimeAsText`).
  final DateTime? startTimeUtc;
  final DateTime? endTimeUtc;

  /// `SessionStatus` wire token.
  final String status;

  /// Explicit weekend ordering; the client never assumes a fixed session set.
  final int orderIndex;
  const SessionRow({
    required this.id,
    required this.grandPrixId,
    required this.type,
    this.name,
    this.startTimeUtc,
    this.endTimeUtc,
    required this.status,
    required this.orderIndex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['grand_prix_id'] = Variable<String>(grandPrixId);
    map['type'] = Variable<String>(type);
    if (!nullToAbsent || name != null) {
      map['name'] = Variable<String>(name);
    }
    if (!nullToAbsent || startTimeUtc != null) {
      map['start_time_utc'] = Variable<DateTime>(startTimeUtc);
    }
    if (!nullToAbsent || endTimeUtc != null) {
      map['end_time_utc'] = Variable<DateTime>(endTimeUtc);
    }
    map['status'] = Variable<String>(status);
    map['order_index'] = Variable<int>(orderIndex);
    return map;
  }

  SessionsCompanion toCompanion(bool nullToAbsent) {
    return SessionsCompanion(
      id: Value(id),
      grandPrixId: Value(grandPrixId),
      type: Value(type),
      name: name == null && nullToAbsent ? const Value.absent() : Value(name),
      startTimeUtc: startTimeUtc == null && nullToAbsent
          ? const Value.absent()
          : Value(startTimeUtc),
      endTimeUtc: endTimeUtc == null && nullToAbsent
          ? const Value.absent()
          : Value(endTimeUtc),
      status: Value(status),
      orderIndex: Value(orderIndex),
    );
  }

  factory SessionRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SessionRow(
      id: serializer.fromJson<String>(json['id']),
      grandPrixId: serializer.fromJson<String>(json['grandPrixId']),
      type: serializer.fromJson<String>(json['type']),
      name: serializer.fromJson<String?>(json['name']),
      startTimeUtc: serializer.fromJson<DateTime?>(json['startTimeUtc']),
      endTimeUtc: serializer.fromJson<DateTime?>(json['endTimeUtc']),
      status: serializer.fromJson<String>(json['status']),
      orderIndex: serializer.fromJson<int>(json['orderIndex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'grandPrixId': serializer.toJson<String>(grandPrixId),
      'type': serializer.toJson<String>(type),
      'name': serializer.toJson<String?>(name),
      'startTimeUtc': serializer.toJson<DateTime?>(startTimeUtc),
      'endTimeUtc': serializer.toJson<DateTime?>(endTimeUtc),
      'status': serializer.toJson<String>(status),
      'orderIndex': serializer.toJson<int>(orderIndex),
    };
  }

  SessionRow copyWith({
    String? id,
    String? grandPrixId,
    String? type,
    Value<String?> name = const Value.absent(),
    Value<DateTime?> startTimeUtc = const Value.absent(),
    Value<DateTime?> endTimeUtc = const Value.absent(),
    String? status,
    int? orderIndex,
  }) => SessionRow(
    id: id ?? this.id,
    grandPrixId: grandPrixId ?? this.grandPrixId,
    type: type ?? this.type,
    name: name.present ? name.value : this.name,
    startTimeUtc: startTimeUtc.present ? startTimeUtc.value : this.startTimeUtc,
    endTimeUtc: endTimeUtc.present ? endTimeUtc.value : this.endTimeUtc,
    status: status ?? this.status,
    orderIndex: orderIndex ?? this.orderIndex,
  );
  SessionRow copyWithCompanion(SessionsCompanion data) {
    return SessionRow(
      id: data.id.present ? data.id.value : this.id,
      grandPrixId: data.grandPrixId.present
          ? data.grandPrixId.value
          : this.grandPrixId,
      type: data.type.present ? data.type.value : this.type,
      name: data.name.present ? data.name.value : this.name,
      startTimeUtc: data.startTimeUtc.present
          ? data.startTimeUtc.value
          : this.startTimeUtc,
      endTimeUtc: data.endTimeUtc.present
          ? data.endTimeUtc.value
          : this.endTimeUtc,
      status: data.status.present ? data.status.value : this.status,
      orderIndex: data.orderIndex.present
          ? data.orderIndex.value
          : this.orderIndex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SessionRow(')
          ..write('id: $id, ')
          ..write('grandPrixId: $grandPrixId, ')
          ..write('type: $type, ')
          ..write('name: $name, ')
          ..write('startTimeUtc: $startTimeUtc, ')
          ..write('endTimeUtc: $endTimeUtc, ')
          ..write('status: $status, ')
          ..write('orderIndex: $orderIndex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    grandPrixId,
    type,
    name,
    startTimeUtc,
    endTimeUtc,
    status,
    orderIndex,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SessionRow &&
          other.id == this.id &&
          other.grandPrixId == this.grandPrixId &&
          other.type == this.type &&
          other.name == this.name &&
          other.startTimeUtc == this.startTimeUtc &&
          other.endTimeUtc == this.endTimeUtc &&
          other.status == this.status &&
          other.orderIndex == this.orderIndex);
}

class SessionsCompanion extends UpdateCompanion<SessionRow> {
  final Value<String> id;
  final Value<String> grandPrixId;
  final Value<String> type;
  final Value<String?> name;
  final Value<DateTime?> startTimeUtc;
  final Value<DateTime?> endTimeUtc;
  final Value<String> status;
  final Value<int> orderIndex;
  final Value<int> rowid;
  const SessionsCompanion({
    this.id = const Value.absent(),
    this.grandPrixId = const Value.absent(),
    this.type = const Value.absent(),
    this.name = const Value.absent(),
    this.startTimeUtc = const Value.absent(),
    this.endTimeUtc = const Value.absent(),
    this.status = const Value.absent(),
    this.orderIndex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SessionsCompanion.insert({
    required String id,
    required String grandPrixId,
    required String type,
    this.name = const Value.absent(),
    this.startTimeUtc = const Value.absent(),
    this.endTimeUtc = const Value.absent(),
    required String status,
    required int orderIndex,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       grandPrixId = Value(grandPrixId),
       type = Value(type),
       status = Value(status),
       orderIndex = Value(orderIndex);
  static Insertable<SessionRow> custom({
    Expression<String>? id,
    Expression<String>? grandPrixId,
    Expression<String>? type,
    Expression<String>? name,
    Expression<DateTime>? startTimeUtc,
    Expression<DateTime>? endTimeUtc,
    Expression<String>? status,
    Expression<int>? orderIndex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (grandPrixId != null) 'grand_prix_id': grandPrixId,
      if (type != null) 'type': type,
      if (name != null) 'name': name,
      if (startTimeUtc != null) 'start_time_utc': startTimeUtc,
      if (endTimeUtc != null) 'end_time_utc': endTimeUtc,
      if (status != null) 'status': status,
      if (orderIndex != null) 'order_index': orderIndex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SessionsCompanion copyWith({
    Value<String>? id,
    Value<String>? grandPrixId,
    Value<String>? type,
    Value<String?>? name,
    Value<DateTime?>? startTimeUtc,
    Value<DateTime?>? endTimeUtc,
    Value<String>? status,
    Value<int>? orderIndex,
    Value<int>? rowid,
  }) {
    return SessionsCompanion(
      id: id ?? this.id,
      grandPrixId: grandPrixId ?? this.grandPrixId,
      type: type ?? this.type,
      name: name ?? this.name,
      startTimeUtc: startTimeUtc ?? this.startTimeUtc,
      endTimeUtc: endTimeUtc ?? this.endTimeUtc,
      status: status ?? this.status,
      orderIndex: orderIndex ?? this.orderIndex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (grandPrixId.present) {
      map['grand_prix_id'] = Variable<String>(grandPrixId.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (startTimeUtc.present) {
      map['start_time_utc'] = Variable<DateTime>(startTimeUtc.value);
    }
    if (endTimeUtc.present) {
      map['end_time_utc'] = Variable<DateTime>(endTimeUtc.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (orderIndex.present) {
      map['order_index'] = Variable<int>(orderIndex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SessionsCompanion(')
          ..write('id: $id, ')
          ..write('grandPrixId: $grandPrixId, ')
          ..write('type: $type, ')
          ..write('name: $name, ')
          ..write('startTimeUtc: $startTimeUtc, ')
          ..write('endTimeUtc: $endTimeUtc, ')
          ..write('status: $status, ')
          ..write('orderIndex: $orderIndex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SnapshotsTable extends Snapshots
    with TableInfo<$SnapshotsTable, SnapshotRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SnapshotsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _generatedAtMeta = const VerificationMeta(
    'generatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> generatedAt = GeneratedColumn<DateTime>(
    'generated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sourceUpdatedAtMeta = const VerificationMeta(
    'sourceUpdatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> sourceUpdatedAt =
      GeneratedColumn<DateTime>(
        'source_updated_at',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _staleAfterMeta = const VerificationMeta(
    'staleAfter',
  );
  @override
  late final GeneratedColumn<DateTime> staleAfter = GeneratedColumn<DateTime>(
    'stale_after',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _contentVersionMeta = const VerificationMeta(
    'contentVersion',
  );
  @override
  late final GeneratedColumn<String> contentVersion = GeneratedColumn<String>(
    'content_version',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _serverStaleMeta = const VerificationMeta(
    'serverStale',
  );
  @override
  late final GeneratedColumn<bool> serverStale = GeneratedColumn<bool>(
    'server_stale',
    aliasedName,
    true,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("server_stale" IN (0, 1))',
    ),
  );
  static const VerificationMeta _focusSeasonMeta = const VerificationMeta(
    'focusSeason',
  );
  @override
  late final GeneratedColumn<int> focusSeason = GeneratedColumn<int>(
    'focus_season',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _focusRoundMeta = const VerificationMeta(
    'focusRound',
  );
  @override
  late final GeneratedColumn<int> focusRound = GeneratedColumn<int>(
    'focus_round',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    key,
    generatedAt,
    sourceUpdatedAt,
    staleAfter,
    contentVersion,
    serverStale,
    focusSeason,
    focusRound,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'snapshots';
  @override
  VerificationContext validateIntegrity(
    Insertable<SnapshotRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('generated_at')) {
      context.handle(
        _generatedAtMeta,
        generatedAt.isAcceptableOrUnknown(
          data['generated_at']!,
          _generatedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_generatedAtMeta);
    }
    if (data.containsKey('source_updated_at')) {
      context.handle(
        _sourceUpdatedAtMeta,
        sourceUpdatedAt.isAcceptableOrUnknown(
          data['source_updated_at']!,
          _sourceUpdatedAtMeta,
        ),
      );
    }
    if (data.containsKey('stale_after')) {
      context.handle(
        _staleAfterMeta,
        staleAfter.isAcceptableOrUnknown(data['stale_after']!, _staleAfterMeta),
      );
    }
    if (data.containsKey('content_version')) {
      context.handle(
        _contentVersionMeta,
        contentVersion.isAcceptableOrUnknown(
          data['content_version']!,
          _contentVersionMeta,
        ),
      );
    }
    if (data.containsKey('server_stale')) {
      context.handle(
        _serverStaleMeta,
        serverStale.isAcceptableOrUnknown(
          data['server_stale']!,
          _serverStaleMeta,
        ),
      );
    }
    if (data.containsKey('focus_season')) {
      context.handle(
        _focusSeasonMeta,
        focusSeason.isAcceptableOrUnknown(
          data['focus_season']!,
          _focusSeasonMeta,
        ),
      );
    }
    if (data.containsKey('focus_round')) {
      context.handle(
        _focusRoundMeta,
        focusRound.isAcceptableOrUnknown(data['focus_round']!, _focusRoundMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  SnapshotRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SnapshotRow(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      generatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}generated_at'],
      )!,
      sourceUpdatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}source_updated_at'],
      ),
      staleAfter: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}stale_after'],
      ),
      contentVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content_version'],
      ),
      serverStale: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}server_stale'],
      ),
      focusSeason: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}focus_season'],
      ),
      focusRound: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}focus_round'],
      ),
    );
  }

  @override
  $SnapshotsTable createAlias(String alias) {
    return $SnapshotsTable(attachedDatabase, alias);
  }
}

class SnapshotRow extends DataClass implements Insertable<SnapshotRow> {
  final String key;

  /// Snapshot generation instant (UTC). Primary ordering key for the
  /// older-snapshot-cannot-overwrite-newer conflict rule.
  final DateTime generatedAt;
  final DateTime? sourceUpdatedAt;
  final DateTime? staleAfter;
  final String? contentVersion;

  /// Server-provided stale flag, when supplied (a fallback when `staleAfter`
  /// is absent).
  final bool? serverStale;

  /// Optional focus pointer: the `home` snapshot records which (season, round)
  /// Grand Prix is its featured/next event so the Home stream can resolve it.
  final int? focusSeason;
  final int? focusRound;
  const SnapshotRow({
    required this.key,
    required this.generatedAt,
    this.sourceUpdatedAt,
    this.staleAfter,
    this.contentVersion,
    this.serverStale,
    this.focusSeason,
    this.focusRound,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['generated_at'] = Variable<DateTime>(generatedAt);
    if (!nullToAbsent || sourceUpdatedAt != null) {
      map['source_updated_at'] = Variable<DateTime>(sourceUpdatedAt);
    }
    if (!nullToAbsent || staleAfter != null) {
      map['stale_after'] = Variable<DateTime>(staleAfter);
    }
    if (!nullToAbsent || contentVersion != null) {
      map['content_version'] = Variable<String>(contentVersion);
    }
    if (!nullToAbsent || serverStale != null) {
      map['server_stale'] = Variable<bool>(serverStale);
    }
    if (!nullToAbsent || focusSeason != null) {
      map['focus_season'] = Variable<int>(focusSeason);
    }
    if (!nullToAbsent || focusRound != null) {
      map['focus_round'] = Variable<int>(focusRound);
    }
    return map;
  }

  SnapshotsCompanion toCompanion(bool nullToAbsent) {
    return SnapshotsCompanion(
      key: Value(key),
      generatedAt: Value(generatedAt),
      sourceUpdatedAt: sourceUpdatedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(sourceUpdatedAt),
      staleAfter: staleAfter == null && nullToAbsent
          ? const Value.absent()
          : Value(staleAfter),
      contentVersion: contentVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(contentVersion),
      serverStale: serverStale == null && nullToAbsent
          ? const Value.absent()
          : Value(serverStale),
      focusSeason: focusSeason == null && nullToAbsent
          ? const Value.absent()
          : Value(focusSeason),
      focusRound: focusRound == null && nullToAbsent
          ? const Value.absent()
          : Value(focusRound),
    );
  }

  factory SnapshotRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SnapshotRow(
      key: serializer.fromJson<String>(json['key']),
      generatedAt: serializer.fromJson<DateTime>(json['generatedAt']),
      sourceUpdatedAt: serializer.fromJson<DateTime?>(json['sourceUpdatedAt']),
      staleAfter: serializer.fromJson<DateTime?>(json['staleAfter']),
      contentVersion: serializer.fromJson<String?>(json['contentVersion']),
      serverStale: serializer.fromJson<bool?>(json['serverStale']),
      focusSeason: serializer.fromJson<int?>(json['focusSeason']),
      focusRound: serializer.fromJson<int?>(json['focusRound']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'generatedAt': serializer.toJson<DateTime>(generatedAt),
      'sourceUpdatedAt': serializer.toJson<DateTime?>(sourceUpdatedAt),
      'staleAfter': serializer.toJson<DateTime?>(staleAfter),
      'contentVersion': serializer.toJson<String?>(contentVersion),
      'serverStale': serializer.toJson<bool?>(serverStale),
      'focusSeason': serializer.toJson<int?>(focusSeason),
      'focusRound': serializer.toJson<int?>(focusRound),
    };
  }

  SnapshotRow copyWith({
    String? key,
    DateTime? generatedAt,
    Value<DateTime?> sourceUpdatedAt = const Value.absent(),
    Value<DateTime?> staleAfter = const Value.absent(),
    Value<String?> contentVersion = const Value.absent(),
    Value<bool?> serverStale = const Value.absent(),
    Value<int?> focusSeason = const Value.absent(),
    Value<int?> focusRound = const Value.absent(),
  }) => SnapshotRow(
    key: key ?? this.key,
    generatedAt: generatedAt ?? this.generatedAt,
    sourceUpdatedAt: sourceUpdatedAt.present
        ? sourceUpdatedAt.value
        : this.sourceUpdatedAt,
    staleAfter: staleAfter.present ? staleAfter.value : this.staleAfter,
    contentVersion: contentVersion.present
        ? contentVersion.value
        : this.contentVersion,
    serverStale: serverStale.present ? serverStale.value : this.serverStale,
    focusSeason: focusSeason.present ? focusSeason.value : this.focusSeason,
    focusRound: focusRound.present ? focusRound.value : this.focusRound,
  );
  SnapshotRow copyWithCompanion(SnapshotsCompanion data) {
    return SnapshotRow(
      key: data.key.present ? data.key.value : this.key,
      generatedAt: data.generatedAt.present
          ? data.generatedAt.value
          : this.generatedAt,
      sourceUpdatedAt: data.sourceUpdatedAt.present
          ? data.sourceUpdatedAt.value
          : this.sourceUpdatedAt,
      staleAfter: data.staleAfter.present
          ? data.staleAfter.value
          : this.staleAfter,
      contentVersion: data.contentVersion.present
          ? data.contentVersion.value
          : this.contentVersion,
      serverStale: data.serverStale.present
          ? data.serverStale.value
          : this.serverStale,
      focusSeason: data.focusSeason.present
          ? data.focusSeason.value
          : this.focusSeason,
      focusRound: data.focusRound.present
          ? data.focusRound.value
          : this.focusRound,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SnapshotRow(')
          ..write('key: $key, ')
          ..write('generatedAt: $generatedAt, ')
          ..write('sourceUpdatedAt: $sourceUpdatedAt, ')
          ..write('staleAfter: $staleAfter, ')
          ..write('contentVersion: $contentVersion, ')
          ..write('serverStale: $serverStale, ')
          ..write('focusSeason: $focusSeason, ')
          ..write('focusRound: $focusRound')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    key,
    generatedAt,
    sourceUpdatedAt,
    staleAfter,
    contentVersion,
    serverStale,
    focusSeason,
    focusRound,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SnapshotRow &&
          other.key == this.key &&
          other.generatedAt == this.generatedAt &&
          other.sourceUpdatedAt == this.sourceUpdatedAt &&
          other.staleAfter == this.staleAfter &&
          other.contentVersion == this.contentVersion &&
          other.serverStale == this.serverStale &&
          other.focusSeason == this.focusSeason &&
          other.focusRound == this.focusRound);
}

class SnapshotsCompanion extends UpdateCompanion<SnapshotRow> {
  final Value<String> key;
  final Value<DateTime> generatedAt;
  final Value<DateTime?> sourceUpdatedAt;
  final Value<DateTime?> staleAfter;
  final Value<String?> contentVersion;
  final Value<bool?> serverStale;
  final Value<int?> focusSeason;
  final Value<int?> focusRound;
  final Value<int> rowid;
  const SnapshotsCompanion({
    this.key = const Value.absent(),
    this.generatedAt = const Value.absent(),
    this.sourceUpdatedAt = const Value.absent(),
    this.staleAfter = const Value.absent(),
    this.contentVersion = const Value.absent(),
    this.serverStale = const Value.absent(),
    this.focusSeason = const Value.absent(),
    this.focusRound = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SnapshotsCompanion.insert({
    required String key,
    required DateTime generatedAt,
    this.sourceUpdatedAt = const Value.absent(),
    this.staleAfter = const Value.absent(),
    this.contentVersion = const Value.absent(),
    this.serverStale = const Value.absent(),
    this.focusSeason = const Value.absent(),
    this.focusRound = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       generatedAt = Value(generatedAt);
  static Insertable<SnapshotRow> custom({
    Expression<String>? key,
    Expression<DateTime>? generatedAt,
    Expression<DateTime>? sourceUpdatedAt,
    Expression<DateTime>? staleAfter,
    Expression<String>? contentVersion,
    Expression<bool>? serverStale,
    Expression<int>? focusSeason,
    Expression<int>? focusRound,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (generatedAt != null) 'generated_at': generatedAt,
      if (sourceUpdatedAt != null) 'source_updated_at': sourceUpdatedAt,
      if (staleAfter != null) 'stale_after': staleAfter,
      if (contentVersion != null) 'content_version': contentVersion,
      if (serverStale != null) 'server_stale': serverStale,
      if (focusSeason != null) 'focus_season': focusSeason,
      if (focusRound != null) 'focus_round': focusRound,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SnapshotsCompanion copyWith({
    Value<String>? key,
    Value<DateTime>? generatedAt,
    Value<DateTime?>? sourceUpdatedAt,
    Value<DateTime?>? staleAfter,
    Value<String?>? contentVersion,
    Value<bool?>? serverStale,
    Value<int?>? focusSeason,
    Value<int?>? focusRound,
    Value<int>? rowid,
  }) {
    return SnapshotsCompanion(
      key: key ?? this.key,
      generatedAt: generatedAt ?? this.generatedAt,
      sourceUpdatedAt: sourceUpdatedAt ?? this.sourceUpdatedAt,
      staleAfter: staleAfter ?? this.staleAfter,
      contentVersion: contentVersion ?? this.contentVersion,
      serverStale: serverStale ?? this.serverStale,
      focusSeason: focusSeason ?? this.focusSeason,
      focusRound: focusRound ?? this.focusRound,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (generatedAt.present) {
      map['generated_at'] = Variable<DateTime>(generatedAt.value);
    }
    if (sourceUpdatedAt.present) {
      map['source_updated_at'] = Variable<DateTime>(sourceUpdatedAt.value);
    }
    if (staleAfter.present) {
      map['stale_after'] = Variable<DateTime>(staleAfter.value);
    }
    if (contentVersion.present) {
      map['content_version'] = Variable<String>(contentVersion.value);
    }
    if (serverStale.present) {
      map['server_stale'] = Variable<bool>(serverStale.value);
    }
    if (focusSeason.present) {
      map['focus_season'] = Variable<int>(focusSeason.value);
    }
    if (focusRound.present) {
      map['focus_round'] = Variable<int>(focusRound.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SnapshotsCompanion(')
          ..write('key: $key, ')
          ..write('generatedAt: $generatedAt, ')
          ..write('sourceUpdatedAt: $sourceUpdatedAt, ')
          ..write('staleAfter: $staleAfter, ')
          ..write('contentVersion: $contentVersion, ')
          ..write('serverStale: $serverStale, ')
          ..write('focusSeason: $focusSeason, ')
          ..write('focusRound: $focusRound, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DriversTable extends Drivers with TableInfo<$DriversTable, DriverRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DriversTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _fullNameMeta = const VerificationMeta(
    'fullName',
  );
  @override
  late final GeneratedColumn<String> fullName = GeneratedColumn<String>(
    'full_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _givenNameMeta = const VerificationMeta(
    'givenName',
  );
  @override
  late final GeneratedColumn<String> givenName = GeneratedColumn<String>(
    'given_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _familyNameMeta = const VerificationMeta(
    'familyName',
  );
  @override
  late final GeneratedColumn<String> familyName = GeneratedColumn<String>(
    'family_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _shortCodeMeta = const VerificationMeta(
    'shortCode',
  );
  @override
  late final GeneratedColumn<String> shortCode = GeneratedColumn<String>(
    'short_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _permanentNumberMeta = const VerificationMeta(
    'permanentNumber',
  );
  @override
  late final GeneratedColumn<int> permanentNumber = GeneratedColumn<int>(
    'permanent_number',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nationalityMeta = const VerificationMeta(
    'nationality',
  );
  @override
  late final GeneratedColumn<String> nationality = GeneratedColumn<String>(
    'nationality',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _countryCodeMeta = const VerificationMeta(
    'countryCode',
  );
  @override
  late final GeneratedColumn<String> countryCode = GeneratedColumn<String>(
    'country_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _dateOfBirthMeta = const VerificationMeta(
    'dateOfBirth',
  );
  @override
  late final GeneratedColumn<String> dateOfBirth = GeneratedColumn<String>(
    'date_of_birth',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _placeOfBirthMeta = const VerificationMeta(
    'placeOfBirth',
  );
  @override
  late final GeneratedColumn<String> placeOfBirth = GeneratedColumn<String>(
    'place_of_birth',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _biographyMeta = const VerificationMeta(
    'biography',
  );
  @override
  late final GeneratedColumn<String> biography = GeneratedColumn<String>(
    'biography',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    fullName,
    givenName,
    familyName,
    shortCode,
    permanentNumber,
    nationality,
    countryCode,
    dateOfBirth,
    placeOfBirth,
    biography,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'drivers';
  @override
  VerificationContext validateIntegrity(
    Insertable<DriverRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('full_name')) {
      context.handle(
        _fullNameMeta,
        fullName.isAcceptableOrUnknown(data['full_name']!, _fullNameMeta),
      );
    } else if (isInserting) {
      context.missing(_fullNameMeta);
    }
    if (data.containsKey('given_name')) {
      context.handle(
        _givenNameMeta,
        givenName.isAcceptableOrUnknown(data['given_name']!, _givenNameMeta),
      );
    }
    if (data.containsKey('family_name')) {
      context.handle(
        _familyNameMeta,
        familyName.isAcceptableOrUnknown(data['family_name']!, _familyNameMeta),
      );
    }
    if (data.containsKey('short_code')) {
      context.handle(
        _shortCodeMeta,
        shortCode.isAcceptableOrUnknown(data['short_code']!, _shortCodeMeta),
      );
    }
    if (data.containsKey('permanent_number')) {
      context.handle(
        _permanentNumberMeta,
        permanentNumber.isAcceptableOrUnknown(
          data['permanent_number']!,
          _permanentNumberMeta,
        ),
      );
    }
    if (data.containsKey('nationality')) {
      context.handle(
        _nationalityMeta,
        nationality.isAcceptableOrUnknown(
          data['nationality']!,
          _nationalityMeta,
        ),
      );
    }
    if (data.containsKey('country_code')) {
      context.handle(
        _countryCodeMeta,
        countryCode.isAcceptableOrUnknown(
          data['country_code']!,
          _countryCodeMeta,
        ),
      );
    }
    if (data.containsKey('date_of_birth')) {
      context.handle(
        _dateOfBirthMeta,
        dateOfBirth.isAcceptableOrUnknown(
          data['date_of_birth']!,
          _dateOfBirthMeta,
        ),
      );
    }
    if (data.containsKey('place_of_birth')) {
      context.handle(
        _placeOfBirthMeta,
        placeOfBirth.isAcceptableOrUnknown(
          data['place_of_birth']!,
          _placeOfBirthMeta,
        ),
      );
    }
    if (data.containsKey('biography')) {
      context.handle(
        _biographyMeta,
        biography.isAcceptableOrUnknown(data['biography']!, _biographyMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DriverRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DriverRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      fullName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}full_name'],
      )!,
      givenName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}given_name'],
      ),
      familyName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}family_name'],
      ),
      shortCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}short_code'],
      ),
      permanentNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}permanent_number'],
      ),
      nationality: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}nationality'],
      ),
      countryCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}country_code'],
      ),
      dateOfBirth: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}date_of_birth'],
      ),
      placeOfBirth: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}place_of_birth'],
      ),
      biography: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}biography'],
      ),
    );
  }

  @override
  $DriversTable createAlias(String alias) {
    return $DriversTable(attachedDatabase, alias);
  }
}

class DriverRow extends DataClass implements Insertable<DriverRow> {
  final String id;
  final String fullName;
  final String? givenName;
  final String? familyName;

  /// Three-letter broadcast code (biographical/current value).
  final String? shortCode;

  /// Career permanent number (season car number lives on the season entry).
  final int? permanentNumber;
  final String? nationality;

  /// ISO 3166-1 alpha-2, uppercase.
  final String? countryCode;

  /// Calendar-only date (`YYYY-MM-DD`); no timezone conversion applied.
  final String? dateOfBirth;
  final String? placeOfBirth;
  final String? biography;
  const DriverRow({
    required this.id,
    required this.fullName,
    this.givenName,
    this.familyName,
    this.shortCode,
    this.permanentNumber,
    this.nationality,
    this.countryCode,
    this.dateOfBirth,
    this.placeOfBirth,
    this.biography,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['full_name'] = Variable<String>(fullName);
    if (!nullToAbsent || givenName != null) {
      map['given_name'] = Variable<String>(givenName);
    }
    if (!nullToAbsent || familyName != null) {
      map['family_name'] = Variable<String>(familyName);
    }
    if (!nullToAbsent || shortCode != null) {
      map['short_code'] = Variable<String>(shortCode);
    }
    if (!nullToAbsent || permanentNumber != null) {
      map['permanent_number'] = Variable<int>(permanentNumber);
    }
    if (!nullToAbsent || nationality != null) {
      map['nationality'] = Variable<String>(nationality);
    }
    if (!nullToAbsent || countryCode != null) {
      map['country_code'] = Variable<String>(countryCode);
    }
    if (!nullToAbsent || dateOfBirth != null) {
      map['date_of_birth'] = Variable<String>(dateOfBirth);
    }
    if (!nullToAbsent || placeOfBirth != null) {
      map['place_of_birth'] = Variable<String>(placeOfBirth);
    }
    if (!nullToAbsent || biography != null) {
      map['biography'] = Variable<String>(biography);
    }
    return map;
  }

  DriversCompanion toCompanion(bool nullToAbsent) {
    return DriversCompanion(
      id: Value(id),
      fullName: Value(fullName),
      givenName: givenName == null && nullToAbsent
          ? const Value.absent()
          : Value(givenName),
      familyName: familyName == null && nullToAbsent
          ? const Value.absent()
          : Value(familyName),
      shortCode: shortCode == null && nullToAbsent
          ? const Value.absent()
          : Value(shortCode),
      permanentNumber: permanentNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(permanentNumber),
      nationality: nationality == null && nullToAbsent
          ? const Value.absent()
          : Value(nationality),
      countryCode: countryCode == null && nullToAbsent
          ? const Value.absent()
          : Value(countryCode),
      dateOfBirth: dateOfBirth == null && nullToAbsent
          ? const Value.absent()
          : Value(dateOfBirth),
      placeOfBirth: placeOfBirth == null && nullToAbsent
          ? const Value.absent()
          : Value(placeOfBirth),
      biography: biography == null && nullToAbsent
          ? const Value.absent()
          : Value(biography),
    );
  }

  factory DriverRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DriverRow(
      id: serializer.fromJson<String>(json['id']),
      fullName: serializer.fromJson<String>(json['fullName']),
      givenName: serializer.fromJson<String?>(json['givenName']),
      familyName: serializer.fromJson<String?>(json['familyName']),
      shortCode: serializer.fromJson<String?>(json['shortCode']),
      permanentNumber: serializer.fromJson<int?>(json['permanentNumber']),
      nationality: serializer.fromJson<String?>(json['nationality']),
      countryCode: serializer.fromJson<String?>(json['countryCode']),
      dateOfBirth: serializer.fromJson<String?>(json['dateOfBirth']),
      placeOfBirth: serializer.fromJson<String?>(json['placeOfBirth']),
      biography: serializer.fromJson<String?>(json['biography']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'fullName': serializer.toJson<String>(fullName),
      'givenName': serializer.toJson<String?>(givenName),
      'familyName': serializer.toJson<String?>(familyName),
      'shortCode': serializer.toJson<String?>(shortCode),
      'permanentNumber': serializer.toJson<int?>(permanentNumber),
      'nationality': serializer.toJson<String?>(nationality),
      'countryCode': serializer.toJson<String?>(countryCode),
      'dateOfBirth': serializer.toJson<String?>(dateOfBirth),
      'placeOfBirth': serializer.toJson<String?>(placeOfBirth),
      'biography': serializer.toJson<String?>(biography),
    };
  }

  DriverRow copyWith({
    String? id,
    String? fullName,
    Value<String?> givenName = const Value.absent(),
    Value<String?> familyName = const Value.absent(),
    Value<String?> shortCode = const Value.absent(),
    Value<int?> permanentNumber = const Value.absent(),
    Value<String?> nationality = const Value.absent(),
    Value<String?> countryCode = const Value.absent(),
    Value<String?> dateOfBirth = const Value.absent(),
    Value<String?> placeOfBirth = const Value.absent(),
    Value<String?> biography = const Value.absent(),
  }) => DriverRow(
    id: id ?? this.id,
    fullName: fullName ?? this.fullName,
    givenName: givenName.present ? givenName.value : this.givenName,
    familyName: familyName.present ? familyName.value : this.familyName,
    shortCode: shortCode.present ? shortCode.value : this.shortCode,
    permanentNumber: permanentNumber.present
        ? permanentNumber.value
        : this.permanentNumber,
    nationality: nationality.present ? nationality.value : this.nationality,
    countryCode: countryCode.present ? countryCode.value : this.countryCode,
    dateOfBirth: dateOfBirth.present ? dateOfBirth.value : this.dateOfBirth,
    placeOfBirth: placeOfBirth.present ? placeOfBirth.value : this.placeOfBirth,
    biography: biography.present ? biography.value : this.biography,
  );
  DriverRow copyWithCompanion(DriversCompanion data) {
    return DriverRow(
      id: data.id.present ? data.id.value : this.id,
      fullName: data.fullName.present ? data.fullName.value : this.fullName,
      givenName: data.givenName.present ? data.givenName.value : this.givenName,
      familyName: data.familyName.present
          ? data.familyName.value
          : this.familyName,
      shortCode: data.shortCode.present ? data.shortCode.value : this.shortCode,
      permanentNumber: data.permanentNumber.present
          ? data.permanentNumber.value
          : this.permanentNumber,
      nationality: data.nationality.present
          ? data.nationality.value
          : this.nationality,
      countryCode: data.countryCode.present
          ? data.countryCode.value
          : this.countryCode,
      dateOfBirth: data.dateOfBirth.present
          ? data.dateOfBirth.value
          : this.dateOfBirth,
      placeOfBirth: data.placeOfBirth.present
          ? data.placeOfBirth.value
          : this.placeOfBirth,
      biography: data.biography.present ? data.biography.value : this.biography,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DriverRow(')
          ..write('id: $id, ')
          ..write('fullName: $fullName, ')
          ..write('givenName: $givenName, ')
          ..write('familyName: $familyName, ')
          ..write('shortCode: $shortCode, ')
          ..write('permanentNumber: $permanentNumber, ')
          ..write('nationality: $nationality, ')
          ..write('countryCode: $countryCode, ')
          ..write('dateOfBirth: $dateOfBirth, ')
          ..write('placeOfBirth: $placeOfBirth, ')
          ..write('biography: $biography')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    fullName,
    givenName,
    familyName,
    shortCode,
    permanentNumber,
    nationality,
    countryCode,
    dateOfBirth,
    placeOfBirth,
    biography,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DriverRow &&
          other.id == this.id &&
          other.fullName == this.fullName &&
          other.givenName == this.givenName &&
          other.familyName == this.familyName &&
          other.shortCode == this.shortCode &&
          other.permanentNumber == this.permanentNumber &&
          other.nationality == this.nationality &&
          other.countryCode == this.countryCode &&
          other.dateOfBirth == this.dateOfBirth &&
          other.placeOfBirth == this.placeOfBirth &&
          other.biography == this.biography);
}

class DriversCompanion extends UpdateCompanion<DriverRow> {
  final Value<String> id;
  final Value<String> fullName;
  final Value<String?> givenName;
  final Value<String?> familyName;
  final Value<String?> shortCode;
  final Value<int?> permanentNumber;
  final Value<String?> nationality;
  final Value<String?> countryCode;
  final Value<String?> dateOfBirth;
  final Value<String?> placeOfBirth;
  final Value<String?> biography;
  final Value<int> rowid;
  const DriversCompanion({
    this.id = const Value.absent(),
    this.fullName = const Value.absent(),
    this.givenName = const Value.absent(),
    this.familyName = const Value.absent(),
    this.shortCode = const Value.absent(),
    this.permanentNumber = const Value.absent(),
    this.nationality = const Value.absent(),
    this.countryCode = const Value.absent(),
    this.dateOfBirth = const Value.absent(),
    this.placeOfBirth = const Value.absent(),
    this.biography = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DriversCompanion.insert({
    required String id,
    required String fullName,
    this.givenName = const Value.absent(),
    this.familyName = const Value.absent(),
    this.shortCode = const Value.absent(),
    this.permanentNumber = const Value.absent(),
    this.nationality = const Value.absent(),
    this.countryCode = const Value.absent(),
    this.dateOfBirth = const Value.absent(),
    this.placeOfBirth = const Value.absent(),
    this.biography = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       fullName = Value(fullName);
  static Insertable<DriverRow> custom({
    Expression<String>? id,
    Expression<String>? fullName,
    Expression<String>? givenName,
    Expression<String>? familyName,
    Expression<String>? shortCode,
    Expression<int>? permanentNumber,
    Expression<String>? nationality,
    Expression<String>? countryCode,
    Expression<String>? dateOfBirth,
    Expression<String>? placeOfBirth,
    Expression<String>? biography,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (fullName != null) 'full_name': fullName,
      if (givenName != null) 'given_name': givenName,
      if (familyName != null) 'family_name': familyName,
      if (shortCode != null) 'short_code': shortCode,
      if (permanentNumber != null) 'permanent_number': permanentNumber,
      if (nationality != null) 'nationality': nationality,
      if (countryCode != null) 'country_code': countryCode,
      if (dateOfBirth != null) 'date_of_birth': dateOfBirth,
      if (placeOfBirth != null) 'place_of_birth': placeOfBirth,
      if (biography != null) 'biography': biography,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DriversCompanion copyWith({
    Value<String>? id,
    Value<String>? fullName,
    Value<String?>? givenName,
    Value<String?>? familyName,
    Value<String?>? shortCode,
    Value<int?>? permanentNumber,
    Value<String?>? nationality,
    Value<String?>? countryCode,
    Value<String?>? dateOfBirth,
    Value<String?>? placeOfBirth,
    Value<String?>? biography,
    Value<int>? rowid,
  }) {
    return DriversCompanion(
      id: id ?? this.id,
      fullName: fullName ?? this.fullName,
      givenName: givenName ?? this.givenName,
      familyName: familyName ?? this.familyName,
      shortCode: shortCode ?? this.shortCode,
      permanentNumber: permanentNumber ?? this.permanentNumber,
      nationality: nationality ?? this.nationality,
      countryCode: countryCode ?? this.countryCode,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      placeOfBirth: placeOfBirth ?? this.placeOfBirth,
      biography: biography ?? this.biography,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (fullName.present) {
      map['full_name'] = Variable<String>(fullName.value);
    }
    if (givenName.present) {
      map['given_name'] = Variable<String>(givenName.value);
    }
    if (familyName.present) {
      map['family_name'] = Variable<String>(familyName.value);
    }
    if (shortCode.present) {
      map['short_code'] = Variable<String>(shortCode.value);
    }
    if (permanentNumber.present) {
      map['permanent_number'] = Variable<int>(permanentNumber.value);
    }
    if (nationality.present) {
      map['nationality'] = Variable<String>(nationality.value);
    }
    if (countryCode.present) {
      map['country_code'] = Variable<String>(countryCode.value);
    }
    if (dateOfBirth.present) {
      map['date_of_birth'] = Variable<String>(dateOfBirth.value);
    }
    if (placeOfBirth.present) {
      map['place_of_birth'] = Variable<String>(placeOfBirth.value);
    }
    if (biography.present) {
      map['biography'] = Variable<String>(biography.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DriversCompanion(')
          ..write('id: $id, ')
          ..write('fullName: $fullName, ')
          ..write('givenName: $givenName, ')
          ..write('familyName: $familyName, ')
          ..write('shortCode: $shortCode, ')
          ..write('permanentNumber: $permanentNumber, ')
          ..write('nationality: $nationality, ')
          ..write('countryCode: $countryCode, ')
          ..write('dateOfBirth: $dateOfBirth, ')
          ..write('placeOfBirth: $placeOfBirth, ')
          ..write('biography: $biography, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ConstructorsTable extends Constructors
    with TableInfo<$ConstructorsTable, ConstructorRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ConstructorsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _shortNameMeta = const VerificationMeta(
    'shortName',
  );
  @override
  late final GeneratedColumn<String> shortName = GeneratedColumn<String>(
    'short_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nationalityMeta = const VerificationMeta(
    'nationality',
  );
  @override
  late final GeneratedColumn<String> nationality = GeneratedColumn<String>(
    'nationality',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _countryCodeMeta = const VerificationMeta(
    'countryCode',
  );
  @override
  late final GeneratedColumn<String> countryCode = GeneratedColumn<String>(
    'country_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _colorPrimaryMeta = const VerificationMeta(
    'colorPrimary',
  );
  @override
  late final GeneratedColumn<String> colorPrimary = GeneratedColumn<String>(
    'color_primary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _biographyMeta = const VerificationMeta(
    'biography',
  );
  @override
  late final GeneratedColumn<String> biography = GeneratedColumn<String>(
    'biography',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    name,
    shortName,
    nationality,
    countryCode,
    colorPrimary,
    biography,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'constructors';
  @override
  VerificationContext validateIntegrity(
    Insertable<ConstructorRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('short_name')) {
      context.handle(
        _shortNameMeta,
        shortName.isAcceptableOrUnknown(data['short_name']!, _shortNameMeta),
      );
    }
    if (data.containsKey('nationality')) {
      context.handle(
        _nationalityMeta,
        nationality.isAcceptableOrUnknown(
          data['nationality']!,
          _nationalityMeta,
        ),
      );
    }
    if (data.containsKey('country_code')) {
      context.handle(
        _countryCodeMeta,
        countryCode.isAcceptableOrUnknown(
          data['country_code']!,
          _countryCodeMeta,
        ),
      );
    }
    if (data.containsKey('color_primary')) {
      context.handle(
        _colorPrimaryMeta,
        colorPrimary.isAcceptableOrUnknown(
          data['color_primary']!,
          _colorPrimaryMeta,
        ),
      );
    }
    if (data.containsKey('biography')) {
      context.handle(
        _biographyMeta,
        biography.isAcceptableOrUnknown(data['biography']!, _biographyMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ConstructorRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ConstructorRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      shortName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}short_name'],
      ),
      nationality: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}nationality'],
      ),
      countryCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}country_code'],
      ),
      colorPrimary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}color_primary'],
      ),
      biography: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}biography'],
      ),
    );
  }

  @override
  $ConstructorsTable createAlias(String alias) {
    return $ConstructorsTable(attachedDatabase, alias);
  }
}

class ConstructorRow extends DataClass implements Insertable<ConstructorRow> {
  final String id;

  /// Canonical base name; season entrant names differ per year.
  final String name;
  final String? shortName;
  final String? nationality;

  /// ISO 3166-1 alpha-2, uppercase.
  final String? countryCode;

  /// Base brand colour `#RRGGBB`; season livery overrides on the season entry.
  final String? colorPrimary;
  final String? biography;
  const ConstructorRow({
    required this.id,
    required this.name,
    this.shortName,
    this.nationality,
    this.countryCode,
    this.colorPrimary,
    this.biography,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || shortName != null) {
      map['short_name'] = Variable<String>(shortName);
    }
    if (!nullToAbsent || nationality != null) {
      map['nationality'] = Variable<String>(nationality);
    }
    if (!nullToAbsent || countryCode != null) {
      map['country_code'] = Variable<String>(countryCode);
    }
    if (!nullToAbsent || colorPrimary != null) {
      map['color_primary'] = Variable<String>(colorPrimary);
    }
    if (!nullToAbsent || biography != null) {
      map['biography'] = Variable<String>(biography);
    }
    return map;
  }

  ConstructorsCompanion toCompanion(bool nullToAbsent) {
    return ConstructorsCompanion(
      id: Value(id),
      name: Value(name),
      shortName: shortName == null && nullToAbsent
          ? const Value.absent()
          : Value(shortName),
      nationality: nationality == null && nullToAbsent
          ? const Value.absent()
          : Value(nationality),
      countryCode: countryCode == null && nullToAbsent
          ? const Value.absent()
          : Value(countryCode),
      colorPrimary: colorPrimary == null && nullToAbsent
          ? const Value.absent()
          : Value(colorPrimary),
      biography: biography == null && nullToAbsent
          ? const Value.absent()
          : Value(biography),
    );
  }

  factory ConstructorRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ConstructorRow(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      shortName: serializer.fromJson<String?>(json['shortName']),
      nationality: serializer.fromJson<String?>(json['nationality']),
      countryCode: serializer.fromJson<String?>(json['countryCode']),
      colorPrimary: serializer.fromJson<String?>(json['colorPrimary']),
      biography: serializer.fromJson<String?>(json['biography']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'shortName': serializer.toJson<String?>(shortName),
      'nationality': serializer.toJson<String?>(nationality),
      'countryCode': serializer.toJson<String?>(countryCode),
      'colorPrimary': serializer.toJson<String?>(colorPrimary),
      'biography': serializer.toJson<String?>(biography),
    };
  }

  ConstructorRow copyWith({
    String? id,
    String? name,
    Value<String?> shortName = const Value.absent(),
    Value<String?> nationality = const Value.absent(),
    Value<String?> countryCode = const Value.absent(),
    Value<String?> colorPrimary = const Value.absent(),
    Value<String?> biography = const Value.absent(),
  }) => ConstructorRow(
    id: id ?? this.id,
    name: name ?? this.name,
    shortName: shortName.present ? shortName.value : this.shortName,
    nationality: nationality.present ? nationality.value : this.nationality,
    countryCode: countryCode.present ? countryCode.value : this.countryCode,
    colorPrimary: colorPrimary.present ? colorPrimary.value : this.colorPrimary,
    biography: biography.present ? biography.value : this.biography,
  );
  ConstructorRow copyWithCompanion(ConstructorsCompanion data) {
    return ConstructorRow(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      shortName: data.shortName.present ? data.shortName.value : this.shortName,
      nationality: data.nationality.present
          ? data.nationality.value
          : this.nationality,
      countryCode: data.countryCode.present
          ? data.countryCode.value
          : this.countryCode,
      colorPrimary: data.colorPrimary.present
          ? data.colorPrimary.value
          : this.colorPrimary,
      biography: data.biography.present ? data.biography.value : this.biography,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ConstructorRow(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('shortName: $shortName, ')
          ..write('nationality: $nationality, ')
          ..write('countryCode: $countryCode, ')
          ..write('colorPrimary: $colorPrimary, ')
          ..write('biography: $biography')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    name,
    shortName,
    nationality,
    countryCode,
    colorPrimary,
    biography,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ConstructorRow &&
          other.id == this.id &&
          other.name == this.name &&
          other.shortName == this.shortName &&
          other.nationality == this.nationality &&
          other.countryCode == this.countryCode &&
          other.colorPrimary == this.colorPrimary &&
          other.biography == this.biography);
}

class ConstructorsCompanion extends UpdateCompanion<ConstructorRow> {
  final Value<String> id;
  final Value<String> name;
  final Value<String?> shortName;
  final Value<String?> nationality;
  final Value<String?> countryCode;
  final Value<String?> colorPrimary;
  final Value<String?> biography;
  final Value<int> rowid;
  const ConstructorsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.shortName = const Value.absent(),
    this.nationality = const Value.absent(),
    this.countryCode = const Value.absent(),
    this.colorPrimary = const Value.absent(),
    this.biography = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ConstructorsCompanion.insert({
    required String id,
    required String name,
    this.shortName = const Value.absent(),
    this.nationality = const Value.absent(),
    this.countryCode = const Value.absent(),
    this.colorPrimary = const Value.absent(),
    this.biography = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       name = Value(name);
  static Insertable<ConstructorRow> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<String>? shortName,
    Expression<String>? nationality,
    Expression<String>? countryCode,
    Expression<String>? colorPrimary,
    Expression<String>? biography,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (shortName != null) 'short_name': shortName,
      if (nationality != null) 'nationality': nationality,
      if (countryCode != null) 'country_code': countryCode,
      if (colorPrimary != null) 'color_primary': colorPrimary,
      if (biography != null) 'biography': biography,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ConstructorsCompanion copyWith({
    Value<String>? id,
    Value<String>? name,
    Value<String?>? shortName,
    Value<String?>? nationality,
    Value<String?>? countryCode,
    Value<String?>? colorPrimary,
    Value<String?>? biography,
    Value<int>? rowid,
  }) {
    return ConstructorsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      shortName: shortName ?? this.shortName,
      nationality: nationality ?? this.nationality,
      countryCode: countryCode ?? this.countryCode,
      colorPrimary: colorPrimary ?? this.colorPrimary,
      biography: biography ?? this.biography,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (shortName.present) {
      map['short_name'] = Variable<String>(shortName.value);
    }
    if (nationality.present) {
      map['nationality'] = Variable<String>(nationality.value);
    }
    if (countryCode.present) {
      map['country_code'] = Variable<String>(countryCode.value);
    }
    if (colorPrimary.present) {
      map['color_primary'] = Variable<String>(colorPrimary.value);
    }
    if (biography.present) {
      map['biography'] = Variable<String>(biography.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ConstructorsCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('shortName: $shortName, ')
          ..write('nationality: $nationality, ')
          ..write('countryCode: $countryCode, ')
          ..write('colorPrimary: $colorPrimary, ')
          ..write('biography: $biography, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DriverSeasonEntriesTable extends DriverSeasonEntries
    with TableInfo<$DriverSeasonEntriesTable, DriverSeasonEntryRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DriverSeasonEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _seasonMeta = const VerificationMeta('season');
  @override
  late final GeneratedColumn<int> season = GeneratedColumn<int>(
    'season',
    aliasedName,
    false,
    check: () => ComparableExpr(season).isBetweenValues(1950, 2100),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES seasons (year) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _driverIdMeta = const VerificationMeta(
    'driverId',
  );
  @override
  late final GeneratedColumn<String> driverId = GeneratedColumn<String>(
    'driver_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES drivers (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _constructorIdMeta = const VerificationMeta(
    'constructorId',
  );
  @override
  late final GeneratedColumn<String> constructorId = GeneratedColumn<String>(
    'constructor_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES constructors (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _raceNumberMeta = const VerificationMeta(
    'raceNumber',
  );
  @override
  late final GeneratedColumn<int> raceNumber = GeneratedColumn<int>(
    'race_number',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _roleMeta = const VerificationMeta('role');
  @override
  late final GeneratedColumn<String> role = GeneratedColumn<String>(
    'role',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _shortCodeMeta = const VerificationMeta(
    'shortCode',
  );
  @override
  late final GeneratedColumn<String> shortCode = GeneratedColumn<String>(
    'short_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _startRoundMeta = const VerificationMeta(
    'startRound',
  );
  @override
  late final GeneratedColumn<int> startRound = GeneratedColumn<int>(
    'start_round',
    aliasedName,
    true,
    check: () => ComparableExpr(startRound).isBetweenValues(1, 30),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _endRoundMeta = const VerificationMeta(
    'endRound',
  );
  @override
  late final GeneratedColumn<int> endRound = GeneratedColumn<int>(
    'end_round',
    aliasedName,
    true,
    check: () => ComparableExpr(endRound).isBetweenValues(1, 30),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    season,
    driverId,
    constructorId,
    raceNumber,
    role,
    shortCode,
    startRound,
    endRound,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'driver_season_entries';
  @override
  VerificationContext validateIntegrity(
    Insertable<DriverSeasonEntryRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('season')) {
      context.handle(
        _seasonMeta,
        season.isAcceptableOrUnknown(data['season']!, _seasonMeta),
      );
    } else if (isInserting) {
      context.missing(_seasonMeta);
    }
    if (data.containsKey('driver_id')) {
      context.handle(
        _driverIdMeta,
        driverId.isAcceptableOrUnknown(data['driver_id']!, _driverIdMeta),
      );
    } else if (isInserting) {
      context.missing(_driverIdMeta);
    }
    if (data.containsKey('constructor_id')) {
      context.handle(
        _constructorIdMeta,
        constructorId.isAcceptableOrUnknown(
          data['constructor_id']!,
          _constructorIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_constructorIdMeta);
    }
    if (data.containsKey('race_number')) {
      context.handle(
        _raceNumberMeta,
        raceNumber.isAcceptableOrUnknown(data['race_number']!, _raceNumberMeta),
      );
    }
    if (data.containsKey('role')) {
      context.handle(
        _roleMeta,
        role.isAcceptableOrUnknown(data['role']!, _roleMeta),
      );
    }
    if (data.containsKey('short_code')) {
      context.handle(
        _shortCodeMeta,
        shortCode.isAcceptableOrUnknown(data['short_code']!, _shortCodeMeta),
      );
    }
    if (data.containsKey('start_round')) {
      context.handle(
        _startRoundMeta,
        startRound.isAcceptableOrUnknown(data['start_round']!, _startRoundMeta),
      );
    }
    if (data.containsKey('end_round')) {
      context.handle(
        _endRoundMeta,
        endRound.isAcceptableOrUnknown(data['end_round']!, _endRoundMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DriverSeasonEntryRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DriverSeasonEntryRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      season: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}season'],
      )!,
      driverId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}driver_id'],
      )!,
      constructorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}constructor_id'],
      )!,
      raceNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}race_number'],
      ),
      role: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}role'],
      ),
      shortCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}short_code'],
      ),
      startRound: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}start_round'],
      ),
      endRound: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}end_round'],
      ),
    );
  }

  @override
  $DriverSeasonEntriesTable createAlias(String alias) {
    return $DriverSeasonEntriesTable(attachedDatabase, alias);
  }
}

class DriverSeasonEntryRow extends DataClass
    implements Insertable<DriverSeasonEntryRow> {
  final String id;
  final int season;
  final String driverId;

  /// Team for this participation span (season-specific).
  final String constructorId;

  /// Season car number (may differ from the driver's permanent number).
  final int? raceNumber;

  /// `DriverRole` wire token.
  final String? role;
  final String? shortCode;

  /// First/last round of the participation span; `null` means from the season
  /// start / until the season end.
  final int? startRound;
  final int? endRound;
  const DriverSeasonEntryRow({
    required this.id,
    required this.season,
    required this.driverId,
    required this.constructorId,
    this.raceNumber,
    this.role,
    this.shortCode,
    this.startRound,
    this.endRound,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['season'] = Variable<int>(season);
    map['driver_id'] = Variable<String>(driverId);
    map['constructor_id'] = Variable<String>(constructorId);
    if (!nullToAbsent || raceNumber != null) {
      map['race_number'] = Variable<int>(raceNumber);
    }
    if (!nullToAbsent || role != null) {
      map['role'] = Variable<String>(role);
    }
    if (!nullToAbsent || shortCode != null) {
      map['short_code'] = Variable<String>(shortCode);
    }
    if (!nullToAbsent || startRound != null) {
      map['start_round'] = Variable<int>(startRound);
    }
    if (!nullToAbsent || endRound != null) {
      map['end_round'] = Variable<int>(endRound);
    }
    return map;
  }

  DriverSeasonEntriesCompanion toCompanion(bool nullToAbsent) {
    return DriverSeasonEntriesCompanion(
      id: Value(id),
      season: Value(season),
      driverId: Value(driverId),
      constructorId: Value(constructorId),
      raceNumber: raceNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(raceNumber),
      role: role == null && nullToAbsent ? const Value.absent() : Value(role),
      shortCode: shortCode == null && nullToAbsent
          ? const Value.absent()
          : Value(shortCode),
      startRound: startRound == null && nullToAbsent
          ? const Value.absent()
          : Value(startRound),
      endRound: endRound == null && nullToAbsent
          ? const Value.absent()
          : Value(endRound),
    );
  }

  factory DriverSeasonEntryRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DriverSeasonEntryRow(
      id: serializer.fromJson<String>(json['id']),
      season: serializer.fromJson<int>(json['season']),
      driverId: serializer.fromJson<String>(json['driverId']),
      constructorId: serializer.fromJson<String>(json['constructorId']),
      raceNumber: serializer.fromJson<int?>(json['raceNumber']),
      role: serializer.fromJson<String?>(json['role']),
      shortCode: serializer.fromJson<String?>(json['shortCode']),
      startRound: serializer.fromJson<int?>(json['startRound']),
      endRound: serializer.fromJson<int?>(json['endRound']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'season': serializer.toJson<int>(season),
      'driverId': serializer.toJson<String>(driverId),
      'constructorId': serializer.toJson<String>(constructorId),
      'raceNumber': serializer.toJson<int?>(raceNumber),
      'role': serializer.toJson<String?>(role),
      'shortCode': serializer.toJson<String?>(shortCode),
      'startRound': serializer.toJson<int?>(startRound),
      'endRound': serializer.toJson<int?>(endRound),
    };
  }

  DriverSeasonEntryRow copyWith({
    String? id,
    int? season,
    String? driverId,
    String? constructorId,
    Value<int?> raceNumber = const Value.absent(),
    Value<String?> role = const Value.absent(),
    Value<String?> shortCode = const Value.absent(),
    Value<int?> startRound = const Value.absent(),
    Value<int?> endRound = const Value.absent(),
  }) => DriverSeasonEntryRow(
    id: id ?? this.id,
    season: season ?? this.season,
    driverId: driverId ?? this.driverId,
    constructorId: constructorId ?? this.constructorId,
    raceNumber: raceNumber.present ? raceNumber.value : this.raceNumber,
    role: role.present ? role.value : this.role,
    shortCode: shortCode.present ? shortCode.value : this.shortCode,
    startRound: startRound.present ? startRound.value : this.startRound,
    endRound: endRound.present ? endRound.value : this.endRound,
  );
  DriverSeasonEntryRow copyWithCompanion(DriverSeasonEntriesCompanion data) {
    return DriverSeasonEntryRow(
      id: data.id.present ? data.id.value : this.id,
      season: data.season.present ? data.season.value : this.season,
      driverId: data.driverId.present ? data.driverId.value : this.driverId,
      constructorId: data.constructorId.present
          ? data.constructorId.value
          : this.constructorId,
      raceNumber: data.raceNumber.present
          ? data.raceNumber.value
          : this.raceNumber,
      role: data.role.present ? data.role.value : this.role,
      shortCode: data.shortCode.present ? data.shortCode.value : this.shortCode,
      startRound: data.startRound.present
          ? data.startRound.value
          : this.startRound,
      endRound: data.endRound.present ? data.endRound.value : this.endRound,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DriverSeasonEntryRow(')
          ..write('id: $id, ')
          ..write('season: $season, ')
          ..write('driverId: $driverId, ')
          ..write('constructorId: $constructorId, ')
          ..write('raceNumber: $raceNumber, ')
          ..write('role: $role, ')
          ..write('shortCode: $shortCode, ')
          ..write('startRound: $startRound, ')
          ..write('endRound: $endRound')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    season,
    driverId,
    constructorId,
    raceNumber,
    role,
    shortCode,
    startRound,
    endRound,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DriverSeasonEntryRow &&
          other.id == this.id &&
          other.season == this.season &&
          other.driverId == this.driverId &&
          other.constructorId == this.constructorId &&
          other.raceNumber == this.raceNumber &&
          other.role == this.role &&
          other.shortCode == this.shortCode &&
          other.startRound == this.startRound &&
          other.endRound == this.endRound);
}

class DriverSeasonEntriesCompanion
    extends UpdateCompanion<DriverSeasonEntryRow> {
  final Value<String> id;
  final Value<int> season;
  final Value<String> driverId;
  final Value<String> constructorId;
  final Value<int?> raceNumber;
  final Value<String?> role;
  final Value<String?> shortCode;
  final Value<int?> startRound;
  final Value<int?> endRound;
  final Value<int> rowid;
  const DriverSeasonEntriesCompanion({
    this.id = const Value.absent(),
    this.season = const Value.absent(),
    this.driverId = const Value.absent(),
    this.constructorId = const Value.absent(),
    this.raceNumber = const Value.absent(),
    this.role = const Value.absent(),
    this.shortCode = const Value.absent(),
    this.startRound = const Value.absent(),
    this.endRound = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DriverSeasonEntriesCompanion.insert({
    required String id,
    required int season,
    required String driverId,
    required String constructorId,
    this.raceNumber = const Value.absent(),
    this.role = const Value.absent(),
    this.shortCode = const Value.absent(),
    this.startRound = const Value.absent(),
    this.endRound = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       season = Value(season),
       driverId = Value(driverId),
       constructorId = Value(constructorId);
  static Insertable<DriverSeasonEntryRow> custom({
    Expression<String>? id,
    Expression<int>? season,
    Expression<String>? driverId,
    Expression<String>? constructorId,
    Expression<int>? raceNumber,
    Expression<String>? role,
    Expression<String>? shortCode,
    Expression<int>? startRound,
    Expression<int>? endRound,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (season != null) 'season': season,
      if (driverId != null) 'driver_id': driverId,
      if (constructorId != null) 'constructor_id': constructorId,
      if (raceNumber != null) 'race_number': raceNumber,
      if (role != null) 'role': role,
      if (shortCode != null) 'short_code': shortCode,
      if (startRound != null) 'start_round': startRound,
      if (endRound != null) 'end_round': endRound,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DriverSeasonEntriesCompanion copyWith({
    Value<String>? id,
    Value<int>? season,
    Value<String>? driverId,
    Value<String>? constructorId,
    Value<int?>? raceNumber,
    Value<String?>? role,
    Value<String?>? shortCode,
    Value<int?>? startRound,
    Value<int?>? endRound,
    Value<int>? rowid,
  }) {
    return DriverSeasonEntriesCompanion(
      id: id ?? this.id,
      season: season ?? this.season,
      driverId: driverId ?? this.driverId,
      constructorId: constructorId ?? this.constructorId,
      raceNumber: raceNumber ?? this.raceNumber,
      role: role ?? this.role,
      shortCode: shortCode ?? this.shortCode,
      startRound: startRound ?? this.startRound,
      endRound: endRound ?? this.endRound,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (season.present) {
      map['season'] = Variable<int>(season.value);
    }
    if (driverId.present) {
      map['driver_id'] = Variable<String>(driverId.value);
    }
    if (constructorId.present) {
      map['constructor_id'] = Variable<String>(constructorId.value);
    }
    if (raceNumber.present) {
      map['race_number'] = Variable<int>(raceNumber.value);
    }
    if (role.present) {
      map['role'] = Variable<String>(role.value);
    }
    if (shortCode.present) {
      map['short_code'] = Variable<String>(shortCode.value);
    }
    if (startRound.present) {
      map['start_round'] = Variable<int>(startRound.value);
    }
    if (endRound.present) {
      map['end_round'] = Variable<int>(endRound.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DriverSeasonEntriesCompanion(')
          ..write('id: $id, ')
          ..write('season: $season, ')
          ..write('driverId: $driverId, ')
          ..write('constructorId: $constructorId, ')
          ..write('raceNumber: $raceNumber, ')
          ..write('role: $role, ')
          ..write('shortCode: $shortCode, ')
          ..write('startRound: $startRound, ')
          ..write('endRound: $endRound, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ConstructorSeasonEntriesTable extends ConstructorSeasonEntries
    with TableInfo<$ConstructorSeasonEntriesTable, ConstructorSeasonEntryRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ConstructorSeasonEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _seasonMeta = const VerificationMeta('season');
  @override
  late final GeneratedColumn<int> season = GeneratedColumn<int>(
    'season',
    aliasedName,
    false,
    check: () => ComparableExpr(season).isBetweenValues(1950, 2100),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES seasons (year) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _constructorIdMeta = const VerificationMeta(
    'constructorId',
  );
  @override
  late final GeneratedColumn<String> constructorId = GeneratedColumn<String>(
    'constructor_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES constructors (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _fullNameMeta = const VerificationMeta(
    'fullName',
  );
  @override
  late final GeneratedColumn<String> fullName = GeneratedColumn<String>(
    'full_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _shortNameMeta = const VerificationMeta(
    'shortName',
  );
  @override
  late final GeneratedColumn<String> shortName = GeneratedColumn<String>(
    'short_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _colorPrimaryMeta = const VerificationMeta(
    'colorPrimary',
  );
  @override
  late final GeneratedColumn<String> colorPrimary = GeneratedColumn<String>(
    'color_primary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _colorSecondaryMeta = const VerificationMeta(
    'colorSecondary',
  );
  @override
  late final GeneratedColumn<String> colorSecondary = GeneratedColumn<String>(
    'color_secondary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _powerUnitMeta = const VerificationMeta(
    'powerUnit',
  );
  @override
  late final GeneratedColumn<String> powerUnit = GeneratedColumn<String>(
    'power_unit',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _teamPrincipalMeta = const VerificationMeta(
    'teamPrincipal',
  );
  @override
  late final GeneratedColumn<String> teamPrincipal = GeneratedColumn<String>(
    'team_principal',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _baseMeta = const VerificationMeta('base');
  @override
  late final GeneratedColumn<String> base = GeneratedColumn<String>(
    'base',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _chassisMeta = const VerificationMeta(
    'chassis',
  );
  @override
  late final GeneratedColumn<String> chassis = GeneratedColumn<String>(
    'chassis',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    season,
    constructorId,
    fullName,
    shortName,
    colorPrimary,
    colorSecondary,
    powerUnit,
    teamPrincipal,
    base,
    chassis,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'constructor_season_entries';
  @override
  VerificationContext validateIntegrity(
    Insertable<ConstructorSeasonEntryRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('season')) {
      context.handle(
        _seasonMeta,
        season.isAcceptableOrUnknown(data['season']!, _seasonMeta),
      );
    } else if (isInserting) {
      context.missing(_seasonMeta);
    }
    if (data.containsKey('constructor_id')) {
      context.handle(
        _constructorIdMeta,
        constructorId.isAcceptableOrUnknown(
          data['constructor_id']!,
          _constructorIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_constructorIdMeta);
    }
    if (data.containsKey('full_name')) {
      context.handle(
        _fullNameMeta,
        fullName.isAcceptableOrUnknown(data['full_name']!, _fullNameMeta),
      );
    }
    if (data.containsKey('short_name')) {
      context.handle(
        _shortNameMeta,
        shortName.isAcceptableOrUnknown(data['short_name']!, _shortNameMeta),
      );
    }
    if (data.containsKey('color_primary')) {
      context.handle(
        _colorPrimaryMeta,
        colorPrimary.isAcceptableOrUnknown(
          data['color_primary']!,
          _colorPrimaryMeta,
        ),
      );
    }
    if (data.containsKey('color_secondary')) {
      context.handle(
        _colorSecondaryMeta,
        colorSecondary.isAcceptableOrUnknown(
          data['color_secondary']!,
          _colorSecondaryMeta,
        ),
      );
    }
    if (data.containsKey('power_unit')) {
      context.handle(
        _powerUnitMeta,
        powerUnit.isAcceptableOrUnknown(data['power_unit']!, _powerUnitMeta),
      );
    }
    if (data.containsKey('team_principal')) {
      context.handle(
        _teamPrincipalMeta,
        teamPrincipal.isAcceptableOrUnknown(
          data['team_principal']!,
          _teamPrincipalMeta,
        ),
      );
    }
    if (data.containsKey('base')) {
      context.handle(
        _baseMeta,
        base.isAcceptableOrUnknown(data['base']!, _baseMeta),
      );
    }
    if (data.containsKey('chassis')) {
      context.handle(
        _chassisMeta,
        chassis.isAcceptableOrUnknown(data['chassis']!, _chassisMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  List<Set<GeneratedColumn>> get uniqueKeys => [
    {season, constructorId},
  ];
  @override
  ConstructorSeasonEntryRow map(
    Map<String, dynamic> data, {
    String? tablePrefix,
  }) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ConstructorSeasonEntryRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      season: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}season'],
      )!,
      constructorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}constructor_id'],
      )!,
      fullName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}full_name'],
      ),
      shortName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}short_name'],
      ),
      colorPrimary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}color_primary'],
      ),
      colorSecondary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}color_secondary'],
      ),
      powerUnit: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}power_unit'],
      ),
      teamPrincipal: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}team_principal'],
      ),
      base: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}base'],
      ),
      chassis: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}chassis'],
      ),
    );
  }

  @override
  $ConstructorSeasonEntriesTable createAlias(String alias) {
    return $ConstructorSeasonEntriesTable(attachedDatabase, alias);
  }
}

class ConstructorSeasonEntryRow extends DataClass
    implements Insertable<ConstructorSeasonEntryRow> {
  final String id;
  final int season;
  final String constructorId;
  final String? fullName;
  final String? shortName;

  /// Season livery colours `#RRGGBB`.
  final String? colorPrimary;
  final String? colorSecondary;
  final String? powerUnit;
  final String? teamPrincipal;
  final String? base;
  final String? chassis;
  const ConstructorSeasonEntryRow({
    required this.id,
    required this.season,
    required this.constructorId,
    this.fullName,
    this.shortName,
    this.colorPrimary,
    this.colorSecondary,
    this.powerUnit,
    this.teamPrincipal,
    this.base,
    this.chassis,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['season'] = Variable<int>(season);
    map['constructor_id'] = Variable<String>(constructorId);
    if (!nullToAbsent || fullName != null) {
      map['full_name'] = Variable<String>(fullName);
    }
    if (!nullToAbsent || shortName != null) {
      map['short_name'] = Variable<String>(shortName);
    }
    if (!nullToAbsent || colorPrimary != null) {
      map['color_primary'] = Variable<String>(colorPrimary);
    }
    if (!nullToAbsent || colorSecondary != null) {
      map['color_secondary'] = Variable<String>(colorSecondary);
    }
    if (!nullToAbsent || powerUnit != null) {
      map['power_unit'] = Variable<String>(powerUnit);
    }
    if (!nullToAbsent || teamPrincipal != null) {
      map['team_principal'] = Variable<String>(teamPrincipal);
    }
    if (!nullToAbsent || base != null) {
      map['base'] = Variable<String>(base);
    }
    if (!nullToAbsent || chassis != null) {
      map['chassis'] = Variable<String>(chassis);
    }
    return map;
  }

  ConstructorSeasonEntriesCompanion toCompanion(bool nullToAbsent) {
    return ConstructorSeasonEntriesCompanion(
      id: Value(id),
      season: Value(season),
      constructorId: Value(constructorId),
      fullName: fullName == null && nullToAbsent
          ? const Value.absent()
          : Value(fullName),
      shortName: shortName == null && nullToAbsent
          ? const Value.absent()
          : Value(shortName),
      colorPrimary: colorPrimary == null && nullToAbsent
          ? const Value.absent()
          : Value(colorPrimary),
      colorSecondary: colorSecondary == null && nullToAbsent
          ? const Value.absent()
          : Value(colorSecondary),
      powerUnit: powerUnit == null && nullToAbsent
          ? const Value.absent()
          : Value(powerUnit),
      teamPrincipal: teamPrincipal == null && nullToAbsent
          ? const Value.absent()
          : Value(teamPrincipal),
      base: base == null && nullToAbsent ? const Value.absent() : Value(base),
      chassis: chassis == null && nullToAbsent
          ? const Value.absent()
          : Value(chassis),
    );
  }

  factory ConstructorSeasonEntryRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ConstructorSeasonEntryRow(
      id: serializer.fromJson<String>(json['id']),
      season: serializer.fromJson<int>(json['season']),
      constructorId: serializer.fromJson<String>(json['constructorId']),
      fullName: serializer.fromJson<String?>(json['fullName']),
      shortName: serializer.fromJson<String?>(json['shortName']),
      colorPrimary: serializer.fromJson<String?>(json['colorPrimary']),
      colorSecondary: serializer.fromJson<String?>(json['colorSecondary']),
      powerUnit: serializer.fromJson<String?>(json['powerUnit']),
      teamPrincipal: serializer.fromJson<String?>(json['teamPrincipal']),
      base: serializer.fromJson<String?>(json['base']),
      chassis: serializer.fromJson<String?>(json['chassis']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'season': serializer.toJson<int>(season),
      'constructorId': serializer.toJson<String>(constructorId),
      'fullName': serializer.toJson<String?>(fullName),
      'shortName': serializer.toJson<String?>(shortName),
      'colorPrimary': serializer.toJson<String?>(colorPrimary),
      'colorSecondary': serializer.toJson<String?>(colorSecondary),
      'powerUnit': serializer.toJson<String?>(powerUnit),
      'teamPrincipal': serializer.toJson<String?>(teamPrincipal),
      'base': serializer.toJson<String?>(base),
      'chassis': serializer.toJson<String?>(chassis),
    };
  }

  ConstructorSeasonEntryRow copyWith({
    String? id,
    int? season,
    String? constructorId,
    Value<String?> fullName = const Value.absent(),
    Value<String?> shortName = const Value.absent(),
    Value<String?> colorPrimary = const Value.absent(),
    Value<String?> colorSecondary = const Value.absent(),
    Value<String?> powerUnit = const Value.absent(),
    Value<String?> teamPrincipal = const Value.absent(),
    Value<String?> base = const Value.absent(),
    Value<String?> chassis = const Value.absent(),
  }) => ConstructorSeasonEntryRow(
    id: id ?? this.id,
    season: season ?? this.season,
    constructorId: constructorId ?? this.constructorId,
    fullName: fullName.present ? fullName.value : this.fullName,
    shortName: shortName.present ? shortName.value : this.shortName,
    colorPrimary: colorPrimary.present ? colorPrimary.value : this.colorPrimary,
    colorSecondary: colorSecondary.present
        ? colorSecondary.value
        : this.colorSecondary,
    powerUnit: powerUnit.present ? powerUnit.value : this.powerUnit,
    teamPrincipal: teamPrincipal.present
        ? teamPrincipal.value
        : this.teamPrincipal,
    base: base.present ? base.value : this.base,
    chassis: chassis.present ? chassis.value : this.chassis,
  );
  ConstructorSeasonEntryRow copyWithCompanion(
    ConstructorSeasonEntriesCompanion data,
  ) {
    return ConstructorSeasonEntryRow(
      id: data.id.present ? data.id.value : this.id,
      season: data.season.present ? data.season.value : this.season,
      constructorId: data.constructorId.present
          ? data.constructorId.value
          : this.constructorId,
      fullName: data.fullName.present ? data.fullName.value : this.fullName,
      shortName: data.shortName.present ? data.shortName.value : this.shortName,
      colorPrimary: data.colorPrimary.present
          ? data.colorPrimary.value
          : this.colorPrimary,
      colorSecondary: data.colorSecondary.present
          ? data.colorSecondary.value
          : this.colorSecondary,
      powerUnit: data.powerUnit.present ? data.powerUnit.value : this.powerUnit,
      teamPrincipal: data.teamPrincipal.present
          ? data.teamPrincipal.value
          : this.teamPrincipal,
      base: data.base.present ? data.base.value : this.base,
      chassis: data.chassis.present ? data.chassis.value : this.chassis,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ConstructorSeasonEntryRow(')
          ..write('id: $id, ')
          ..write('season: $season, ')
          ..write('constructorId: $constructorId, ')
          ..write('fullName: $fullName, ')
          ..write('shortName: $shortName, ')
          ..write('colorPrimary: $colorPrimary, ')
          ..write('colorSecondary: $colorSecondary, ')
          ..write('powerUnit: $powerUnit, ')
          ..write('teamPrincipal: $teamPrincipal, ')
          ..write('base: $base, ')
          ..write('chassis: $chassis')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    season,
    constructorId,
    fullName,
    shortName,
    colorPrimary,
    colorSecondary,
    powerUnit,
    teamPrincipal,
    base,
    chassis,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ConstructorSeasonEntryRow &&
          other.id == this.id &&
          other.season == this.season &&
          other.constructorId == this.constructorId &&
          other.fullName == this.fullName &&
          other.shortName == this.shortName &&
          other.colorPrimary == this.colorPrimary &&
          other.colorSecondary == this.colorSecondary &&
          other.powerUnit == this.powerUnit &&
          other.teamPrincipal == this.teamPrincipal &&
          other.base == this.base &&
          other.chassis == this.chassis);
}

class ConstructorSeasonEntriesCompanion
    extends UpdateCompanion<ConstructorSeasonEntryRow> {
  final Value<String> id;
  final Value<int> season;
  final Value<String> constructorId;
  final Value<String?> fullName;
  final Value<String?> shortName;
  final Value<String?> colorPrimary;
  final Value<String?> colorSecondary;
  final Value<String?> powerUnit;
  final Value<String?> teamPrincipal;
  final Value<String?> base;
  final Value<String?> chassis;
  final Value<int> rowid;
  const ConstructorSeasonEntriesCompanion({
    this.id = const Value.absent(),
    this.season = const Value.absent(),
    this.constructorId = const Value.absent(),
    this.fullName = const Value.absent(),
    this.shortName = const Value.absent(),
    this.colorPrimary = const Value.absent(),
    this.colorSecondary = const Value.absent(),
    this.powerUnit = const Value.absent(),
    this.teamPrincipal = const Value.absent(),
    this.base = const Value.absent(),
    this.chassis = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ConstructorSeasonEntriesCompanion.insert({
    required String id,
    required int season,
    required String constructorId,
    this.fullName = const Value.absent(),
    this.shortName = const Value.absent(),
    this.colorPrimary = const Value.absent(),
    this.colorSecondary = const Value.absent(),
    this.powerUnit = const Value.absent(),
    this.teamPrincipal = const Value.absent(),
    this.base = const Value.absent(),
    this.chassis = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       season = Value(season),
       constructorId = Value(constructorId);
  static Insertable<ConstructorSeasonEntryRow> custom({
    Expression<String>? id,
    Expression<int>? season,
    Expression<String>? constructorId,
    Expression<String>? fullName,
    Expression<String>? shortName,
    Expression<String>? colorPrimary,
    Expression<String>? colorSecondary,
    Expression<String>? powerUnit,
    Expression<String>? teamPrincipal,
    Expression<String>? base,
    Expression<String>? chassis,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (season != null) 'season': season,
      if (constructorId != null) 'constructor_id': constructorId,
      if (fullName != null) 'full_name': fullName,
      if (shortName != null) 'short_name': shortName,
      if (colorPrimary != null) 'color_primary': colorPrimary,
      if (colorSecondary != null) 'color_secondary': colorSecondary,
      if (powerUnit != null) 'power_unit': powerUnit,
      if (teamPrincipal != null) 'team_principal': teamPrincipal,
      if (base != null) 'base': base,
      if (chassis != null) 'chassis': chassis,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ConstructorSeasonEntriesCompanion copyWith({
    Value<String>? id,
    Value<int>? season,
    Value<String>? constructorId,
    Value<String?>? fullName,
    Value<String?>? shortName,
    Value<String?>? colorPrimary,
    Value<String?>? colorSecondary,
    Value<String?>? powerUnit,
    Value<String?>? teamPrincipal,
    Value<String?>? base,
    Value<String?>? chassis,
    Value<int>? rowid,
  }) {
    return ConstructorSeasonEntriesCompanion(
      id: id ?? this.id,
      season: season ?? this.season,
      constructorId: constructorId ?? this.constructorId,
      fullName: fullName ?? this.fullName,
      shortName: shortName ?? this.shortName,
      colorPrimary: colorPrimary ?? this.colorPrimary,
      colorSecondary: colorSecondary ?? this.colorSecondary,
      powerUnit: powerUnit ?? this.powerUnit,
      teamPrincipal: teamPrincipal ?? this.teamPrincipal,
      base: base ?? this.base,
      chassis: chassis ?? this.chassis,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (season.present) {
      map['season'] = Variable<int>(season.value);
    }
    if (constructorId.present) {
      map['constructor_id'] = Variable<String>(constructorId.value);
    }
    if (fullName.present) {
      map['full_name'] = Variable<String>(fullName.value);
    }
    if (shortName.present) {
      map['short_name'] = Variable<String>(shortName.value);
    }
    if (colorPrimary.present) {
      map['color_primary'] = Variable<String>(colorPrimary.value);
    }
    if (colorSecondary.present) {
      map['color_secondary'] = Variable<String>(colorSecondary.value);
    }
    if (powerUnit.present) {
      map['power_unit'] = Variable<String>(powerUnit.value);
    }
    if (teamPrincipal.present) {
      map['team_principal'] = Variable<String>(teamPrincipal.value);
    }
    if (base.present) {
      map['base'] = Variable<String>(base.value);
    }
    if (chassis.present) {
      map['chassis'] = Variable<String>(chassis.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ConstructorSeasonEntriesCompanion(')
          ..write('id: $id, ')
          ..write('season: $season, ')
          ..write('constructorId: $constructorId, ')
          ..write('fullName: $fullName, ')
          ..write('shortName: $shortName, ')
          ..write('colorPrimary: $colorPrimary, ')
          ..write('colorSecondary: $colorSecondary, ')
          ..write('powerUnit: $powerUnit, ')
          ..write('teamPrincipal: $teamPrincipal, ')
          ..write('base: $base, ')
          ..write('chassis: $chassis, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DriverStandingsTable extends DriverStandings
    with TableInfo<$DriverStandingsTable, DriverStandingRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DriverStandingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _seasonMeta = const VerificationMeta('season');
  @override
  late final GeneratedColumn<int> season = GeneratedColumn<int>(
    'season',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES seasons (year) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _driverIdMeta = const VerificationMeta(
    'driverId',
  );
  @override
  late final GeneratedColumn<String> driverId = GeneratedColumn<String>(
    'driver_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES drivers (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _constructorIdMeta = const VerificationMeta(
    'constructorId',
  );
  @override
  late final GeneratedColumn<String> constructorId = GeneratedColumn<String>(
    'constructor_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES constructors (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _positionMeta = const VerificationMeta(
    'position',
  );
  @override
  late final GeneratedColumn<int> position = GeneratedColumn<int>(
    'position',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _pointsMeta = const VerificationMeta('points');
  @override
  late final GeneratedColumn<double> points = GeneratedColumn<double>(
    'points',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _winsMeta = const VerificationMeta('wins');
  @override
  late final GeneratedColumn<int> wins = GeneratedColumn<int>(
    'wins',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _podiumsMeta = const VerificationMeta(
    'podiums',
  );
  @override
  late final GeneratedColumn<int> podiums = GeneratedColumn<int>(
    'podiums',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _provisionalMeta = const VerificationMeta(
    'provisional',
  );
  @override
  late final GeneratedColumn<bool> provisional = GeneratedColumn<bool>(
    'provisional',
    aliasedName,
    true,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("provisional" IN (0, 1))',
    ),
  );
  static const VerificationMeta _orderIndexMeta = const VerificationMeta(
    'orderIndex',
  );
  @override
  late final GeneratedColumn<int> orderIndex = GeneratedColumn<int>(
    'order_index',
    aliasedName,
    false,
    check: () => ComparableExpr(orderIndex).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    season,
    driverId,
    constructorId,
    position,
    points,
    wins,
    podiums,
    provisional,
    orderIndex,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'driver_standings';
  @override
  VerificationContext validateIntegrity(
    Insertable<DriverStandingRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('season')) {
      context.handle(
        _seasonMeta,
        season.isAcceptableOrUnknown(data['season']!, _seasonMeta),
      );
    } else if (isInserting) {
      context.missing(_seasonMeta);
    }
    if (data.containsKey('driver_id')) {
      context.handle(
        _driverIdMeta,
        driverId.isAcceptableOrUnknown(data['driver_id']!, _driverIdMeta),
      );
    } else if (isInserting) {
      context.missing(_driverIdMeta);
    }
    if (data.containsKey('constructor_id')) {
      context.handle(
        _constructorIdMeta,
        constructorId.isAcceptableOrUnknown(
          data['constructor_id']!,
          _constructorIdMeta,
        ),
      );
    }
    if (data.containsKey('position')) {
      context.handle(
        _positionMeta,
        position.isAcceptableOrUnknown(data['position']!, _positionMeta),
      );
    }
    if (data.containsKey('points')) {
      context.handle(
        _pointsMeta,
        points.isAcceptableOrUnknown(data['points']!, _pointsMeta),
      );
    } else if (isInserting) {
      context.missing(_pointsMeta);
    }
    if (data.containsKey('wins')) {
      context.handle(
        _winsMeta,
        wins.isAcceptableOrUnknown(data['wins']!, _winsMeta),
      );
    }
    if (data.containsKey('podiums')) {
      context.handle(
        _podiumsMeta,
        podiums.isAcceptableOrUnknown(data['podiums']!, _podiumsMeta),
      );
    }
    if (data.containsKey('provisional')) {
      context.handle(
        _provisionalMeta,
        provisional.isAcceptableOrUnknown(
          data['provisional']!,
          _provisionalMeta,
        ),
      );
    }
    if (data.containsKey('order_index')) {
      context.handle(
        _orderIndexMeta,
        orderIndex.isAcceptableOrUnknown(data['order_index']!, _orderIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIndexMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {season, driverId};
  @override
  DriverStandingRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DriverStandingRow(
      season: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}season'],
      )!,
      driverId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}driver_id'],
      )!,
      constructorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}constructor_id'],
      ),
      position: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}position'],
      ),
      points: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}points'],
      )!,
      wins: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}wins'],
      ),
      podiums: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}podiums'],
      ),
      provisional: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}provisional'],
      ),
      orderIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}order_index'],
      )!,
    );
  }

  @override
  $DriverStandingsTable createAlias(String alias) {
    return $DriverStandingsTable(attachedDatabase, alias);
  }
}

class DriverStandingRow extends DataClass
    implements Insertable<DriverStandingRow> {
  final int season;
  final String driverId;

  /// Primary team for context; nullable per the domain model.
  final String? constructorId;
  final int? position;

  /// Championship points; fractional values are valid.
  final double points;
  final int? wins;
  final int? podiums;
  final bool? provisional;

  /// Authoritative championship order (0-based position in the delivered list).
  final int orderIndex;
  const DriverStandingRow({
    required this.season,
    required this.driverId,
    this.constructorId,
    this.position,
    required this.points,
    this.wins,
    this.podiums,
    this.provisional,
    required this.orderIndex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['season'] = Variable<int>(season);
    map['driver_id'] = Variable<String>(driverId);
    if (!nullToAbsent || constructorId != null) {
      map['constructor_id'] = Variable<String>(constructorId);
    }
    if (!nullToAbsent || position != null) {
      map['position'] = Variable<int>(position);
    }
    map['points'] = Variable<double>(points);
    if (!nullToAbsent || wins != null) {
      map['wins'] = Variable<int>(wins);
    }
    if (!nullToAbsent || podiums != null) {
      map['podiums'] = Variable<int>(podiums);
    }
    if (!nullToAbsent || provisional != null) {
      map['provisional'] = Variable<bool>(provisional);
    }
    map['order_index'] = Variable<int>(orderIndex);
    return map;
  }

  DriverStandingsCompanion toCompanion(bool nullToAbsent) {
    return DriverStandingsCompanion(
      season: Value(season),
      driverId: Value(driverId),
      constructorId: constructorId == null && nullToAbsent
          ? const Value.absent()
          : Value(constructorId),
      position: position == null && nullToAbsent
          ? const Value.absent()
          : Value(position),
      points: Value(points),
      wins: wins == null && nullToAbsent ? const Value.absent() : Value(wins),
      podiums: podiums == null && nullToAbsent
          ? const Value.absent()
          : Value(podiums),
      provisional: provisional == null && nullToAbsent
          ? const Value.absent()
          : Value(provisional),
      orderIndex: Value(orderIndex),
    );
  }

  factory DriverStandingRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DriverStandingRow(
      season: serializer.fromJson<int>(json['season']),
      driverId: serializer.fromJson<String>(json['driverId']),
      constructorId: serializer.fromJson<String?>(json['constructorId']),
      position: serializer.fromJson<int?>(json['position']),
      points: serializer.fromJson<double>(json['points']),
      wins: serializer.fromJson<int?>(json['wins']),
      podiums: serializer.fromJson<int?>(json['podiums']),
      provisional: serializer.fromJson<bool?>(json['provisional']),
      orderIndex: serializer.fromJson<int>(json['orderIndex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'season': serializer.toJson<int>(season),
      'driverId': serializer.toJson<String>(driverId),
      'constructorId': serializer.toJson<String?>(constructorId),
      'position': serializer.toJson<int?>(position),
      'points': serializer.toJson<double>(points),
      'wins': serializer.toJson<int?>(wins),
      'podiums': serializer.toJson<int?>(podiums),
      'provisional': serializer.toJson<bool?>(provisional),
      'orderIndex': serializer.toJson<int>(orderIndex),
    };
  }

  DriverStandingRow copyWith({
    int? season,
    String? driverId,
    Value<String?> constructorId = const Value.absent(),
    Value<int?> position = const Value.absent(),
    double? points,
    Value<int?> wins = const Value.absent(),
    Value<int?> podiums = const Value.absent(),
    Value<bool?> provisional = const Value.absent(),
    int? orderIndex,
  }) => DriverStandingRow(
    season: season ?? this.season,
    driverId: driverId ?? this.driverId,
    constructorId: constructorId.present
        ? constructorId.value
        : this.constructorId,
    position: position.present ? position.value : this.position,
    points: points ?? this.points,
    wins: wins.present ? wins.value : this.wins,
    podiums: podiums.present ? podiums.value : this.podiums,
    provisional: provisional.present ? provisional.value : this.provisional,
    orderIndex: orderIndex ?? this.orderIndex,
  );
  DriverStandingRow copyWithCompanion(DriverStandingsCompanion data) {
    return DriverStandingRow(
      season: data.season.present ? data.season.value : this.season,
      driverId: data.driverId.present ? data.driverId.value : this.driverId,
      constructorId: data.constructorId.present
          ? data.constructorId.value
          : this.constructorId,
      position: data.position.present ? data.position.value : this.position,
      points: data.points.present ? data.points.value : this.points,
      wins: data.wins.present ? data.wins.value : this.wins,
      podiums: data.podiums.present ? data.podiums.value : this.podiums,
      provisional: data.provisional.present
          ? data.provisional.value
          : this.provisional,
      orderIndex: data.orderIndex.present
          ? data.orderIndex.value
          : this.orderIndex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DriverStandingRow(')
          ..write('season: $season, ')
          ..write('driverId: $driverId, ')
          ..write('constructorId: $constructorId, ')
          ..write('position: $position, ')
          ..write('points: $points, ')
          ..write('wins: $wins, ')
          ..write('podiums: $podiums, ')
          ..write('provisional: $provisional, ')
          ..write('orderIndex: $orderIndex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    season,
    driverId,
    constructorId,
    position,
    points,
    wins,
    podiums,
    provisional,
    orderIndex,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DriverStandingRow &&
          other.season == this.season &&
          other.driverId == this.driverId &&
          other.constructorId == this.constructorId &&
          other.position == this.position &&
          other.points == this.points &&
          other.wins == this.wins &&
          other.podiums == this.podiums &&
          other.provisional == this.provisional &&
          other.orderIndex == this.orderIndex);
}

class DriverStandingsCompanion extends UpdateCompanion<DriverStandingRow> {
  final Value<int> season;
  final Value<String> driverId;
  final Value<String?> constructorId;
  final Value<int?> position;
  final Value<double> points;
  final Value<int?> wins;
  final Value<int?> podiums;
  final Value<bool?> provisional;
  final Value<int> orderIndex;
  final Value<int> rowid;
  const DriverStandingsCompanion({
    this.season = const Value.absent(),
    this.driverId = const Value.absent(),
    this.constructorId = const Value.absent(),
    this.position = const Value.absent(),
    this.points = const Value.absent(),
    this.wins = const Value.absent(),
    this.podiums = const Value.absent(),
    this.provisional = const Value.absent(),
    this.orderIndex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DriverStandingsCompanion.insert({
    required int season,
    required String driverId,
    this.constructorId = const Value.absent(),
    this.position = const Value.absent(),
    required double points,
    this.wins = const Value.absent(),
    this.podiums = const Value.absent(),
    this.provisional = const Value.absent(),
    required int orderIndex,
    this.rowid = const Value.absent(),
  }) : season = Value(season),
       driverId = Value(driverId),
       points = Value(points),
       orderIndex = Value(orderIndex);
  static Insertable<DriverStandingRow> custom({
    Expression<int>? season,
    Expression<String>? driverId,
    Expression<String>? constructorId,
    Expression<int>? position,
    Expression<double>? points,
    Expression<int>? wins,
    Expression<int>? podiums,
    Expression<bool>? provisional,
    Expression<int>? orderIndex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (season != null) 'season': season,
      if (driverId != null) 'driver_id': driverId,
      if (constructorId != null) 'constructor_id': constructorId,
      if (position != null) 'position': position,
      if (points != null) 'points': points,
      if (wins != null) 'wins': wins,
      if (podiums != null) 'podiums': podiums,
      if (provisional != null) 'provisional': provisional,
      if (orderIndex != null) 'order_index': orderIndex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DriverStandingsCompanion copyWith({
    Value<int>? season,
    Value<String>? driverId,
    Value<String?>? constructorId,
    Value<int?>? position,
    Value<double>? points,
    Value<int?>? wins,
    Value<int?>? podiums,
    Value<bool?>? provisional,
    Value<int>? orderIndex,
    Value<int>? rowid,
  }) {
    return DriverStandingsCompanion(
      season: season ?? this.season,
      driverId: driverId ?? this.driverId,
      constructorId: constructorId ?? this.constructorId,
      position: position ?? this.position,
      points: points ?? this.points,
      wins: wins ?? this.wins,
      podiums: podiums ?? this.podiums,
      provisional: provisional ?? this.provisional,
      orderIndex: orderIndex ?? this.orderIndex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (season.present) {
      map['season'] = Variable<int>(season.value);
    }
    if (driverId.present) {
      map['driver_id'] = Variable<String>(driverId.value);
    }
    if (constructorId.present) {
      map['constructor_id'] = Variable<String>(constructorId.value);
    }
    if (position.present) {
      map['position'] = Variable<int>(position.value);
    }
    if (points.present) {
      map['points'] = Variable<double>(points.value);
    }
    if (wins.present) {
      map['wins'] = Variable<int>(wins.value);
    }
    if (podiums.present) {
      map['podiums'] = Variable<int>(podiums.value);
    }
    if (provisional.present) {
      map['provisional'] = Variable<bool>(provisional.value);
    }
    if (orderIndex.present) {
      map['order_index'] = Variable<int>(orderIndex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DriverStandingsCompanion(')
          ..write('season: $season, ')
          ..write('driverId: $driverId, ')
          ..write('constructorId: $constructorId, ')
          ..write('position: $position, ')
          ..write('points: $points, ')
          ..write('wins: $wins, ')
          ..write('podiums: $podiums, ')
          ..write('provisional: $provisional, ')
          ..write('orderIndex: $orderIndex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ConstructorStandingsTable extends ConstructorStandings
    with TableInfo<$ConstructorStandingsTable, ConstructorStandingRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ConstructorStandingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _seasonMeta = const VerificationMeta('season');
  @override
  late final GeneratedColumn<int> season = GeneratedColumn<int>(
    'season',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES seasons (year) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _constructorIdMeta = const VerificationMeta(
    'constructorId',
  );
  @override
  late final GeneratedColumn<String> constructorId = GeneratedColumn<String>(
    'constructor_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES constructors (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _positionMeta = const VerificationMeta(
    'position',
  );
  @override
  late final GeneratedColumn<int> position = GeneratedColumn<int>(
    'position',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _pointsMeta = const VerificationMeta('points');
  @override
  late final GeneratedColumn<double> points = GeneratedColumn<double>(
    'points',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _winsMeta = const VerificationMeta('wins');
  @override
  late final GeneratedColumn<int> wins = GeneratedColumn<int>(
    'wins',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _provisionalMeta = const VerificationMeta(
    'provisional',
  );
  @override
  late final GeneratedColumn<bool> provisional = GeneratedColumn<bool>(
    'provisional',
    aliasedName,
    true,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("provisional" IN (0, 1))',
    ),
  );
  static const VerificationMeta _orderIndexMeta = const VerificationMeta(
    'orderIndex',
  );
  @override
  late final GeneratedColumn<int> orderIndex = GeneratedColumn<int>(
    'order_index',
    aliasedName,
    false,
    check: () => ComparableExpr(orderIndex).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    season,
    constructorId,
    position,
    points,
    wins,
    provisional,
    orderIndex,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'constructor_standings';
  @override
  VerificationContext validateIntegrity(
    Insertable<ConstructorStandingRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('season')) {
      context.handle(
        _seasonMeta,
        season.isAcceptableOrUnknown(data['season']!, _seasonMeta),
      );
    } else if (isInserting) {
      context.missing(_seasonMeta);
    }
    if (data.containsKey('constructor_id')) {
      context.handle(
        _constructorIdMeta,
        constructorId.isAcceptableOrUnknown(
          data['constructor_id']!,
          _constructorIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_constructorIdMeta);
    }
    if (data.containsKey('position')) {
      context.handle(
        _positionMeta,
        position.isAcceptableOrUnknown(data['position']!, _positionMeta),
      );
    }
    if (data.containsKey('points')) {
      context.handle(
        _pointsMeta,
        points.isAcceptableOrUnknown(data['points']!, _pointsMeta),
      );
    } else if (isInserting) {
      context.missing(_pointsMeta);
    }
    if (data.containsKey('wins')) {
      context.handle(
        _winsMeta,
        wins.isAcceptableOrUnknown(data['wins']!, _winsMeta),
      );
    }
    if (data.containsKey('provisional')) {
      context.handle(
        _provisionalMeta,
        provisional.isAcceptableOrUnknown(
          data['provisional']!,
          _provisionalMeta,
        ),
      );
    }
    if (data.containsKey('order_index')) {
      context.handle(
        _orderIndexMeta,
        orderIndex.isAcceptableOrUnknown(data['order_index']!, _orderIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIndexMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {season, constructorId};
  @override
  ConstructorStandingRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ConstructorStandingRow(
      season: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}season'],
      )!,
      constructorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}constructor_id'],
      )!,
      position: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}position'],
      ),
      points: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}points'],
      )!,
      wins: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}wins'],
      ),
      provisional: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}provisional'],
      ),
      orderIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}order_index'],
      )!,
    );
  }

  @override
  $ConstructorStandingsTable createAlias(String alias) {
    return $ConstructorStandingsTable(attachedDatabase, alias);
  }
}

class ConstructorStandingRow extends DataClass
    implements Insertable<ConstructorStandingRow> {
  final int season;
  final String constructorId;
  final int? position;

  /// Championship points; fractional values are valid.
  final double points;
  final int? wins;
  final bool? provisional;

  /// Authoritative championship order (0-based position in the delivered list).
  final int orderIndex;
  const ConstructorStandingRow({
    required this.season,
    required this.constructorId,
    this.position,
    required this.points,
    this.wins,
    this.provisional,
    required this.orderIndex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['season'] = Variable<int>(season);
    map['constructor_id'] = Variable<String>(constructorId);
    if (!nullToAbsent || position != null) {
      map['position'] = Variable<int>(position);
    }
    map['points'] = Variable<double>(points);
    if (!nullToAbsent || wins != null) {
      map['wins'] = Variable<int>(wins);
    }
    if (!nullToAbsent || provisional != null) {
      map['provisional'] = Variable<bool>(provisional);
    }
    map['order_index'] = Variable<int>(orderIndex);
    return map;
  }

  ConstructorStandingsCompanion toCompanion(bool nullToAbsent) {
    return ConstructorStandingsCompanion(
      season: Value(season),
      constructorId: Value(constructorId),
      position: position == null && nullToAbsent
          ? const Value.absent()
          : Value(position),
      points: Value(points),
      wins: wins == null && nullToAbsent ? const Value.absent() : Value(wins),
      provisional: provisional == null && nullToAbsent
          ? const Value.absent()
          : Value(provisional),
      orderIndex: Value(orderIndex),
    );
  }

  factory ConstructorStandingRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ConstructorStandingRow(
      season: serializer.fromJson<int>(json['season']),
      constructorId: serializer.fromJson<String>(json['constructorId']),
      position: serializer.fromJson<int?>(json['position']),
      points: serializer.fromJson<double>(json['points']),
      wins: serializer.fromJson<int?>(json['wins']),
      provisional: serializer.fromJson<bool?>(json['provisional']),
      orderIndex: serializer.fromJson<int>(json['orderIndex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'season': serializer.toJson<int>(season),
      'constructorId': serializer.toJson<String>(constructorId),
      'position': serializer.toJson<int?>(position),
      'points': serializer.toJson<double>(points),
      'wins': serializer.toJson<int?>(wins),
      'provisional': serializer.toJson<bool?>(provisional),
      'orderIndex': serializer.toJson<int>(orderIndex),
    };
  }

  ConstructorStandingRow copyWith({
    int? season,
    String? constructorId,
    Value<int?> position = const Value.absent(),
    double? points,
    Value<int?> wins = const Value.absent(),
    Value<bool?> provisional = const Value.absent(),
    int? orderIndex,
  }) => ConstructorStandingRow(
    season: season ?? this.season,
    constructorId: constructorId ?? this.constructorId,
    position: position.present ? position.value : this.position,
    points: points ?? this.points,
    wins: wins.present ? wins.value : this.wins,
    provisional: provisional.present ? provisional.value : this.provisional,
    orderIndex: orderIndex ?? this.orderIndex,
  );
  ConstructorStandingRow copyWithCompanion(ConstructorStandingsCompanion data) {
    return ConstructorStandingRow(
      season: data.season.present ? data.season.value : this.season,
      constructorId: data.constructorId.present
          ? data.constructorId.value
          : this.constructorId,
      position: data.position.present ? data.position.value : this.position,
      points: data.points.present ? data.points.value : this.points,
      wins: data.wins.present ? data.wins.value : this.wins,
      provisional: data.provisional.present
          ? data.provisional.value
          : this.provisional,
      orderIndex: data.orderIndex.present
          ? data.orderIndex.value
          : this.orderIndex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ConstructorStandingRow(')
          ..write('season: $season, ')
          ..write('constructorId: $constructorId, ')
          ..write('position: $position, ')
          ..write('points: $points, ')
          ..write('wins: $wins, ')
          ..write('provisional: $provisional, ')
          ..write('orderIndex: $orderIndex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    season,
    constructorId,
    position,
    points,
    wins,
    provisional,
    orderIndex,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ConstructorStandingRow &&
          other.season == this.season &&
          other.constructorId == this.constructorId &&
          other.position == this.position &&
          other.points == this.points &&
          other.wins == this.wins &&
          other.provisional == this.provisional &&
          other.orderIndex == this.orderIndex);
}

class ConstructorStandingsCompanion
    extends UpdateCompanion<ConstructorStandingRow> {
  final Value<int> season;
  final Value<String> constructorId;
  final Value<int?> position;
  final Value<double> points;
  final Value<int?> wins;
  final Value<bool?> provisional;
  final Value<int> orderIndex;
  final Value<int> rowid;
  const ConstructorStandingsCompanion({
    this.season = const Value.absent(),
    this.constructorId = const Value.absent(),
    this.position = const Value.absent(),
    this.points = const Value.absent(),
    this.wins = const Value.absent(),
    this.provisional = const Value.absent(),
    this.orderIndex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ConstructorStandingsCompanion.insert({
    required int season,
    required String constructorId,
    this.position = const Value.absent(),
    required double points,
    this.wins = const Value.absent(),
    this.provisional = const Value.absent(),
    required int orderIndex,
    this.rowid = const Value.absent(),
  }) : season = Value(season),
       constructorId = Value(constructorId),
       points = Value(points),
       orderIndex = Value(orderIndex);
  static Insertable<ConstructorStandingRow> custom({
    Expression<int>? season,
    Expression<String>? constructorId,
    Expression<int>? position,
    Expression<double>? points,
    Expression<int>? wins,
    Expression<bool>? provisional,
    Expression<int>? orderIndex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (season != null) 'season': season,
      if (constructorId != null) 'constructor_id': constructorId,
      if (position != null) 'position': position,
      if (points != null) 'points': points,
      if (wins != null) 'wins': wins,
      if (provisional != null) 'provisional': provisional,
      if (orderIndex != null) 'order_index': orderIndex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ConstructorStandingsCompanion copyWith({
    Value<int>? season,
    Value<String>? constructorId,
    Value<int?>? position,
    Value<double>? points,
    Value<int?>? wins,
    Value<bool?>? provisional,
    Value<int>? orderIndex,
    Value<int>? rowid,
  }) {
    return ConstructorStandingsCompanion(
      season: season ?? this.season,
      constructorId: constructorId ?? this.constructorId,
      position: position ?? this.position,
      points: points ?? this.points,
      wins: wins ?? this.wins,
      provisional: provisional ?? this.provisional,
      orderIndex: orderIndex ?? this.orderIndex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (season.present) {
      map['season'] = Variable<int>(season.value);
    }
    if (constructorId.present) {
      map['constructor_id'] = Variable<String>(constructorId.value);
    }
    if (position.present) {
      map['position'] = Variable<int>(position.value);
    }
    if (points.present) {
      map['points'] = Variable<double>(points.value);
    }
    if (wins.present) {
      map['wins'] = Variable<int>(wins.value);
    }
    if (provisional.present) {
      map['provisional'] = Variable<bool>(provisional.value);
    }
    if (orderIndex.present) {
      map['order_index'] = Variable<int>(orderIndex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ConstructorStandingsCompanion(')
          ..write('season: $season, ')
          ..write('constructorId: $constructorId, ')
          ..write('position: $position, ')
          ..write('points: $points, ')
          ..write('wins: $wins, ')
          ..write('provisional: $provisional, ')
          ..write('orderIndex: $orderIndex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RaceResultsTable extends RaceResults
    with TableInfo<$RaceResultsTable, RaceResultRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RaceResultsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _seasonMeta = const VerificationMeta('season');
  @override
  late final GeneratedColumn<int> season = GeneratedColumn<int>(
    'season',
    aliasedName,
    false,
    check: () => ComparableExpr(season).isBetweenValues(1950, 2100),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _roundMeta = const VerificationMeta('round');
  @override
  late final GeneratedColumn<int> round = GeneratedColumn<int>(
    'round',
    aliasedName,
    false,
    check: () => ComparableExpr(round).isBetweenValues(1, 30),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _grandPrixIdMeta = const VerificationMeta(
    'grandPrixId',
  );
  @override
  late final GeneratedColumn<String> grandPrixId = GeneratedColumn<String>(
    'grand_prix_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES grand_prix (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _sessionTypeMeta = const VerificationMeta(
    'sessionType',
  );
  @override
  late final GeneratedColumn<String> sessionType = GeneratedColumn<String>(
    'session_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _fastestLapDriverIdMeta =
      const VerificationMeta('fastestLapDriverId');
  @override
  late final GeneratedColumn<String> fastestLapDriverId =
      GeneratedColumn<String>(
        'fastest_lap_driver_id',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _fastestLapTimeMillisMeta =
      const VerificationMeta('fastestLapTimeMillis');
  @override
  late final GeneratedColumn<int> fastestLapTimeMillis = GeneratedColumn<int>(
    'fastest_lap_time_millis',
    aliasedName,
    true,
    check: () => ComparableExpr(fastestLapTimeMillis).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _fastestLapLapMeta = const VerificationMeta(
    'fastestLapLap',
  );
  @override
  late final GeneratedColumn<int> fastestLapLap = GeneratedColumn<int>(
    'fastest_lap_lap',
    aliasedName,
    true,
    check: () => ComparableExpr(fastestLapLap).isBiggerOrEqualValue(1),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    season,
    round,
    grandPrixId,
    sessionType,
    status,
    fastestLapDriverId,
    fastestLapTimeMillis,
    fastestLapLap,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'race_results';
  @override
  VerificationContext validateIntegrity(
    Insertable<RaceResultRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('season')) {
      context.handle(
        _seasonMeta,
        season.isAcceptableOrUnknown(data['season']!, _seasonMeta),
      );
    } else if (isInserting) {
      context.missing(_seasonMeta);
    }
    if (data.containsKey('round')) {
      context.handle(
        _roundMeta,
        round.isAcceptableOrUnknown(data['round']!, _roundMeta),
      );
    } else if (isInserting) {
      context.missing(_roundMeta);
    }
    if (data.containsKey('grand_prix_id')) {
      context.handle(
        _grandPrixIdMeta,
        grandPrixId.isAcceptableOrUnknown(
          data['grand_prix_id']!,
          _grandPrixIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_grandPrixIdMeta);
    }
    if (data.containsKey('session_type')) {
      context.handle(
        _sessionTypeMeta,
        sessionType.isAcceptableOrUnknown(
          data['session_type']!,
          _sessionTypeMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_sessionTypeMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('fastest_lap_driver_id')) {
      context.handle(
        _fastestLapDriverIdMeta,
        fastestLapDriverId.isAcceptableOrUnknown(
          data['fastest_lap_driver_id']!,
          _fastestLapDriverIdMeta,
        ),
      );
    }
    if (data.containsKey('fastest_lap_time_millis')) {
      context.handle(
        _fastestLapTimeMillisMeta,
        fastestLapTimeMillis.isAcceptableOrUnknown(
          data['fastest_lap_time_millis']!,
          _fastestLapTimeMillisMeta,
        ),
      );
    }
    if (data.containsKey('fastest_lap_lap')) {
      context.handle(
        _fastestLapLapMeta,
        fastestLapLap.isAcceptableOrUnknown(
          data['fastest_lap_lap']!,
          _fastestLapLapMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  List<Set<GeneratedColumn>> get uniqueKeys => [
    {grandPrixId, sessionType},
  ];
  @override
  RaceResultRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RaceResultRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      season: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}season'],
      )!,
      round: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}round'],
      )!,
      grandPrixId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}grand_prix_id'],
      )!,
      sessionType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}session_type'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      fastestLapDriverId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}fastest_lap_driver_id'],
      ),
      fastestLapTimeMillis: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}fastest_lap_time_millis'],
      ),
      fastestLapLap: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}fastest_lap_lap'],
      ),
    );
  }

  @override
  $RaceResultsTable createAlias(String alias) {
    return $RaceResultsTable(attachedDatabase, alias);
  }
}

class RaceResultRow extends DataClass implements Insertable<RaceResultRow> {
  final String id;
  final int season;
  final int round;

  /// Cascades: removing a Grand Prix removes its result documents.
  final String grandPrixId;

  /// `SessionType` wire token (`race` or `sprint`).
  final String sessionType;

  /// `ResultStatus` wire token.
  final String status;

  /// Optional session fastest lap, flattened from the domain `FastestLap` value
  /// object. The duration is stored as whole milliseconds.
  final String? fastestLapDriverId;
  final int? fastestLapTimeMillis;
  final int? fastestLapLap;
  const RaceResultRow({
    required this.id,
    required this.season,
    required this.round,
    required this.grandPrixId,
    required this.sessionType,
    required this.status,
    this.fastestLapDriverId,
    this.fastestLapTimeMillis,
    this.fastestLapLap,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['season'] = Variable<int>(season);
    map['round'] = Variable<int>(round);
    map['grand_prix_id'] = Variable<String>(grandPrixId);
    map['session_type'] = Variable<String>(sessionType);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || fastestLapDriverId != null) {
      map['fastest_lap_driver_id'] = Variable<String>(fastestLapDriverId);
    }
    if (!nullToAbsent || fastestLapTimeMillis != null) {
      map['fastest_lap_time_millis'] = Variable<int>(fastestLapTimeMillis);
    }
    if (!nullToAbsent || fastestLapLap != null) {
      map['fastest_lap_lap'] = Variable<int>(fastestLapLap);
    }
    return map;
  }

  RaceResultsCompanion toCompanion(bool nullToAbsent) {
    return RaceResultsCompanion(
      id: Value(id),
      season: Value(season),
      round: Value(round),
      grandPrixId: Value(grandPrixId),
      sessionType: Value(sessionType),
      status: Value(status),
      fastestLapDriverId: fastestLapDriverId == null && nullToAbsent
          ? const Value.absent()
          : Value(fastestLapDriverId),
      fastestLapTimeMillis: fastestLapTimeMillis == null && nullToAbsent
          ? const Value.absent()
          : Value(fastestLapTimeMillis),
      fastestLapLap: fastestLapLap == null && nullToAbsent
          ? const Value.absent()
          : Value(fastestLapLap),
    );
  }

  factory RaceResultRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RaceResultRow(
      id: serializer.fromJson<String>(json['id']),
      season: serializer.fromJson<int>(json['season']),
      round: serializer.fromJson<int>(json['round']),
      grandPrixId: serializer.fromJson<String>(json['grandPrixId']),
      sessionType: serializer.fromJson<String>(json['sessionType']),
      status: serializer.fromJson<String>(json['status']),
      fastestLapDriverId: serializer.fromJson<String?>(
        json['fastestLapDriverId'],
      ),
      fastestLapTimeMillis: serializer.fromJson<int?>(
        json['fastestLapTimeMillis'],
      ),
      fastestLapLap: serializer.fromJson<int?>(json['fastestLapLap']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'season': serializer.toJson<int>(season),
      'round': serializer.toJson<int>(round),
      'grandPrixId': serializer.toJson<String>(grandPrixId),
      'sessionType': serializer.toJson<String>(sessionType),
      'status': serializer.toJson<String>(status),
      'fastestLapDriverId': serializer.toJson<String?>(fastestLapDriverId),
      'fastestLapTimeMillis': serializer.toJson<int?>(fastestLapTimeMillis),
      'fastestLapLap': serializer.toJson<int?>(fastestLapLap),
    };
  }

  RaceResultRow copyWith({
    String? id,
    int? season,
    int? round,
    String? grandPrixId,
    String? sessionType,
    String? status,
    Value<String?> fastestLapDriverId = const Value.absent(),
    Value<int?> fastestLapTimeMillis = const Value.absent(),
    Value<int?> fastestLapLap = const Value.absent(),
  }) => RaceResultRow(
    id: id ?? this.id,
    season: season ?? this.season,
    round: round ?? this.round,
    grandPrixId: grandPrixId ?? this.grandPrixId,
    sessionType: sessionType ?? this.sessionType,
    status: status ?? this.status,
    fastestLapDriverId: fastestLapDriverId.present
        ? fastestLapDriverId.value
        : this.fastestLapDriverId,
    fastestLapTimeMillis: fastestLapTimeMillis.present
        ? fastestLapTimeMillis.value
        : this.fastestLapTimeMillis,
    fastestLapLap: fastestLapLap.present
        ? fastestLapLap.value
        : this.fastestLapLap,
  );
  RaceResultRow copyWithCompanion(RaceResultsCompanion data) {
    return RaceResultRow(
      id: data.id.present ? data.id.value : this.id,
      season: data.season.present ? data.season.value : this.season,
      round: data.round.present ? data.round.value : this.round,
      grandPrixId: data.grandPrixId.present
          ? data.grandPrixId.value
          : this.grandPrixId,
      sessionType: data.sessionType.present
          ? data.sessionType.value
          : this.sessionType,
      status: data.status.present ? data.status.value : this.status,
      fastestLapDriverId: data.fastestLapDriverId.present
          ? data.fastestLapDriverId.value
          : this.fastestLapDriverId,
      fastestLapTimeMillis: data.fastestLapTimeMillis.present
          ? data.fastestLapTimeMillis.value
          : this.fastestLapTimeMillis,
      fastestLapLap: data.fastestLapLap.present
          ? data.fastestLapLap.value
          : this.fastestLapLap,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RaceResultRow(')
          ..write('id: $id, ')
          ..write('season: $season, ')
          ..write('round: $round, ')
          ..write('grandPrixId: $grandPrixId, ')
          ..write('sessionType: $sessionType, ')
          ..write('status: $status, ')
          ..write('fastestLapDriverId: $fastestLapDriverId, ')
          ..write('fastestLapTimeMillis: $fastestLapTimeMillis, ')
          ..write('fastestLapLap: $fastestLapLap')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    season,
    round,
    grandPrixId,
    sessionType,
    status,
    fastestLapDriverId,
    fastestLapTimeMillis,
    fastestLapLap,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RaceResultRow &&
          other.id == this.id &&
          other.season == this.season &&
          other.round == this.round &&
          other.grandPrixId == this.grandPrixId &&
          other.sessionType == this.sessionType &&
          other.status == this.status &&
          other.fastestLapDriverId == this.fastestLapDriverId &&
          other.fastestLapTimeMillis == this.fastestLapTimeMillis &&
          other.fastestLapLap == this.fastestLapLap);
}

class RaceResultsCompanion extends UpdateCompanion<RaceResultRow> {
  final Value<String> id;
  final Value<int> season;
  final Value<int> round;
  final Value<String> grandPrixId;
  final Value<String> sessionType;
  final Value<String> status;
  final Value<String?> fastestLapDriverId;
  final Value<int?> fastestLapTimeMillis;
  final Value<int?> fastestLapLap;
  final Value<int> rowid;
  const RaceResultsCompanion({
    this.id = const Value.absent(),
    this.season = const Value.absent(),
    this.round = const Value.absent(),
    this.grandPrixId = const Value.absent(),
    this.sessionType = const Value.absent(),
    this.status = const Value.absent(),
    this.fastestLapDriverId = const Value.absent(),
    this.fastestLapTimeMillis = const Value.absent(),
    this.fastestLapLap = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RaceResultsCompanion.insert({
    required String id,
    required int season,
    required int round,
    required String grandPrixId,
    required String sessionType,
    required String status,
    this.fastestLapDriverId = const Value.absent(),
    this.fastestLapTimeMillis = const Value.absent(),
    this.fastestLapLap = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       season = Value(season),
       round = Value(round),
       grandPrixId = Value(grandPrixId),
       sessionType = Value(sessionType),
       status = Value(status);
  static Insertable<RaceResultRow> custom({
    Expression<String>? id,
    Expression<int>? season,
    Expression<int>? round,
    Expression<String>? grandPrixId,
    Expression<String>? sessionType,
    Expression<String>? status,
    Expression<String>? fastestLapDriverId,
    Expression<int>? fastestLapTimeMillis,
    Expression<int>? fastestLapLap,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (season != null) 'season': season,
      if (round != null) 'round': round,
      if (grandPrixId != null) 'grand_prix_id': grandPrixId,
      if (sessionType != null) 'session_type': sessionType,
      if (status != null) 'status': status,
      if (fastestLapDriverId != null)
        'fastest_lap_driver_id': fastestLapDriverId,
      if (fastestLapTimeMillis != null)
        'fastest_lap_time_millis': fastestLapTimeMillis,
      if (fastestLapLap != null) 'fastest_lap_lap': fastestLapLap,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RaceResultsCompanion copyWith({
    Value<String>? id,
    Value<int>? season,
    Value<int>? round,
    Value<String>? grandPrixId,
    Value<String>? sessionType,
    Value<String>? status,
    Value<String?>? fastestLapDriverId,
    Value<int?>? fastestLapTimeMillis,
    Value<int?>? fastestLapLap,
    Value<int>? rowid,
  }) {
    return RaceResultsCompanion(
      id: id ?? this.id,
      season: season ?? this.season,
      round: round ?? this.round,
      grandPrixId: grandPrixId ?? this.grandPrixId,
      sessionType: sessionType ?? this.sessionType,
      status: status ?? this.status,
      fastestLapDriverId: fastestLapDriverId ?? this.fastestLapDriverId,
      fastestLapTimeMillis: fastestLapTimeMillis ?? this.fastestLapTimeMillis,
      fastestLapLap: fastestLapLap ?? this.fastestLapLap,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (season.present) {
      map['season'] = Variable<int>(season.value);
    }
    if (round.present) {
      map['round'] = Variable<int>(round.value);
    }
    if (grandPrixId.present) {
      map['grand_prix_id'] = Variable<String>(grandPrixId.value);
    }
    if (sessionType.present) {
      map['session_type'] = Variable<String>(sessionType.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (fastestLapDriverId.present) {
      map['fastest_lap_driver_id'] = Variable<String>(fastestLapDriverId.value);
    }
    if (fastestLapTimeMillis.present) {
      map['fastest_lap_time_millis'] = Variable<int>(
        fastestLapTimeMillis.value,
      );
    }
    if (fastestLapLap.present) {
      map['fastest_lap_lap'] = Variable<int>(fastestLapLap.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RaceResultsCompanion(')
          ..write('id: $id, ')
          ..write('season: $season, ')
          ..write('round: $round, ')
          ..write('grandPrixId: $grandPrixId, ')
          ..write('sessionType: $sessionType, ')
          ..write('status: $status, ')
          ..write('fastestLapDriverId: $fastestLapDriverId, ')
          ..write('fastestLapTimeMillis: $fastestLapTimeMillis, ')
          ..write('fastestLapLap: $fastestLapLap, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RaceResultEntriesTable extends RaceResultEntries
    with TableInfo<$RaceResultEntriesTable, RaceResultEntryRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RaceResultEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _raceResultIdMeta = const VerificationMeta(
    'raceResultId',
  );
  @override
  late final GeneratedColumn<String> raceResultId = GeneratedColumn<String>(
    'race_result_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES race_results (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _driverIdMeta = const VerificationMeta(
    'driverId',
  );
  @override
  late final GeneratedColumn<String> driverId = GeneratedColumn<String>(
    'driver_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES drivers (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _constructorIdMeta = const VerificationMeta(
    'constructorId',
  );
  @override
  late final GeneratedColumn<String> constructorId = GeneratedColumn<String>(
    'constructor_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES constructors (id) ON DELETE NO ACTION',
    ),
  );
  static const VerificationMeta _positionMeta = const VerificationMeta(
    'position',
  );
  @override
  late final GeneratedColumn<int> position = GeneratedColumn<int>(
    'position',
    aliasedName,
    true,
    check: () => ComparableExpr(position).isBiggerOrEqualValue(1),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _gridPositionMeta = const VerificationMeta(
    'gridPosition',
  );
  @override
  late final GeneratedColumn<int> gridPosition = GeneratedColumn<int>(
    'grid_position',
    aliasedName,
    true,
    check: () => ComparableExpr(gridPosition).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _pointsMeta = const VerificationMeta('points');
  @override
  late final GeneratedColumn<double> points = GeneratedColumn<double>(
    'points',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _lapsMeta = const VerificationMeta('laps');
  @override
  late final GeneratedColumn<int> laps = GeneratedColumn<int>(
    'laps',
    aliasedName,
    true,
    check: () => ComparableExpr(laps).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _elapsedTimeMillisMeta = const VerificationMeta(
    'elapsedTimeMillis',
  );
  @override
  late final GeneratedColumn<int> elapsedTimeMillis = GeneratedColumn<int>(
    'elapsed_time_millis',
    aliasedName,
    true,
    check: () => ComparableExpr(elapsedTimeMillis).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _gapToLeaderMillisMeta = const VerificationMeta(
    'gapToLeaderMillis',
  );
  @override
  late final GeneratedColumn<int> gapToLeaderMillis = GeneratedColumn<int>(
    'gap_to_leader_millis',
    aliasedName,
    true,
    check: () => ComparableExpr(gapToLeaderMillis).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lapsBehindMeta = const VerificationMeta(
    'lapsBehind',
  );
  @override
  late final GeneratedColumn<int> lapsBehind = GeneratedColumn<int>(
    'laps_behind',
    aliasedName,
    true,
    check: () => ComparableExpr(lapsBehind).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _fastestLapMeta = const VerificationMeta(
    'fastestLap',
  );
  @override
  late final GeneratedColumn<bool> fastestLap = GeneratedColumn<bool>(
    'fastest_lap',
    aliasedName,
    true,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("fastest_lap" IN (0, 1))',
    ),
  );
  static const VerificationMeta _dnfReasonMeta = const VerificationMeta(
    'dnfReason',
  );
  @override
  late final GeneratedColumn<String> dnfReason = GeneratedColumn<String>(
    'dnf_reason',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _gapTextMeta = const VerificationMeta(
    'gapText',
  );
  @override
  late final GeneratedColumn<String> gapText = GeneratedColumn<String>(
    'gap_text',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _orderIndexMeta = const VerificationMeta(
    'orderIndex',
  );
  @override
  late final GeneratedColumn<int> orderIndex = GeneratedColumn<int>(
    'order_index',
    aliasedName,
    false,
    check: () => ComparableExpr(orderIndex).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    raceResultId,
    driverId,
    constructorId,
    position,
    gridPosition,
    points,
    status,
    laps,
    elapsedTimeMillis,
    gapToLeaderMillis,
    lapsBehind,
    fastestLap,
    dnfReason,
    gapText,
    orderIndex,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'race_result_entries';
  @override
  VerificationContext validateIntegrity(
    Insertable<RaceResultEntryRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('race_result_id')) {
      context.handle(
        _raceResultIdMeta,
        raceResultId.isAcceptableOrUnknown(
          data['race_result_id']!,
          _raceResultIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_raceResultIdMeta);
    }
    if (data.containsKey('driver_id')) {
      context.handle(
        _driverIdMeta,
        driverId.isAcceptableOrUnknown(data['driver_id']!, _driverIdMeta),
      );
    } else if (isInserting) {
      context.missing(_driverIdMeta);
    }
    if (data.containsKey('constructor_id')) {
      context.handle(
        _constructorIdMeta,
        constructorId.isAcceptableOrUnknown(
          data['constructor_id']!,
          _constructorIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_constructorIdMeta);
    }
    if (data.containsKey('position')) {
      context.handle(
        _positionMeta,
        position.isAcceptableOrUnknown(data['position']!, _positionMeta),
      );
    }
    if (data.containsKey('grid_position')) {
      context.handle(
        _gridPositionMeta,
        gridPosition.isAcceptableOrUnknown(
          data['grid_position']!,
          _gridPositionMeta,
        ),
      );
    }
    if (data.containsKey('points')) {
      context.handle(
        _pointsMeta,
        points.isAcceptableOrUnknown(data['points']!, _pointsMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('laps')) {
      context.handle(
        _lapsMeta,
        laps.isAcceptableOrUnknown(data['laps']!, _lapsMeta),
      );
    }
    if (data.containsKey('elapsed_time_millis')) {
      context.handle(
        _elapsedTimeMillisMeta,
        elapsedTimeMillis.isAcceptableOrUnknown(
          data['elapsed_time_millis']!,
          _elapsedTimeMillisMeta,
        ),
      );
    }
    if (data.containsKey('gap_to_leader_millis')) {
      context.handle(
        _gapToLeaderMillisMeta,
        gapToLeaderMillis.isAcceptableOrUnknown(
          data['gap_to_leader_millis']!,
          _gapToLeaderMillisMeta,
        ),
      );
    }
    if (data.containsKey('laps_behind')) {
      context.handle(
        _lapsBehindMeta,
        lapsBehind.isAcceptableOrUnknown(data['laps_behind']!, _lapsBehindMeta),
      );
    }
    if (data.containsKey('fastest_lap')) {
      context.handle(
        _fastestLapMeta,
        fastestLap.isAcceptableOrUnknown(data['fastest_lap']!, _fastestLapMeta),
      );
    }
    if (data.containsKey('dnf_reason')) {
      context.handle(
        _dnfReasonMeta,
        dnfReason.isAcceptableOrUnknown(data['dnf_reason']!, _dnfReasonMeta),
      );
    }
    if (data.containsKey('gap_text')) {
      context.handle(
        _gapTextMeta,
        gapText.isAcceptableOrUnknown(data['gap_text']!, _gapTextMeta),
      );
    }
    if (data.containsKey('order_index')) {
      context.handle(
        _orderIndexMeta,
        orderIndex.isAcceptableOrUnknown(data['order_index']!, _orderIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIndexMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {raceResultId, driverId};
  @override
  RaceResultEntryRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RaceResultEntryRow(
      raceResultId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}race_result_id'],
      )!,
      driverId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}driver_id'],
      )!,
      constructorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}constructor_id'],
      )!,
      position: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}position'],
      ),
      gridPosition: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}grid_position'],
      ),
      points: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}points'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      laps: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}laps'],
      ),
      elapsedTimeMillis: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}elapsed_time_millis'],
      ),
      gapToLeaderMillis: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}gap_to_leader_millis'],
      ),
      lapsBehind: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}laps_behind'],
      ),
      fastestLap: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}fastest_lap'],
      ),
      dnfReason: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}dnf_reason'],
      ),
      gapText: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}gap_text'],
      ),
      orderIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}order_index'],
      )!,
    );
  }

  @override
  $RaceResultEntriesTable createAlias(String alias) {
    return $RaceResultEntriesTable(attachedDatabase, alias);
  }
}

class RaceResultEntryRow extends DataClass
    implements Insertable<RaceResultEntryRow> {
  /// Cascades: removing a result document removes its classification rows.
  final String raceResultId;
  final String driverId;
  final String constructorId;
  final int? position;
  final int? gridPosition;

  /// Points scored; fractional values are valid; `null` when none is the
  /// confirmed absence.
  final double? points;

  /// `FinishStatus` wire token.
  final String status;
  final int? laps;

  /// Total elapsed race time for a classified finisher, in whole milliseconds.
  final int? elapsedTimeMillis;

  /// Gap to the leader for a same-lap finisher, in whole milliseconds.
  final int? gapToLeaderMillis;

  /// Whole laps behind the leader for a lapped finisher.
  final int? lapsBehind;
  final bool? fastestLap;
  final String? dnfReason;

  /// Optional display fallback only; never the sole gap representation.
  final String? gapText;

  /// Explicit classification ordering.
  final int orderIndex;
  const RaceResultEntryRow({
    required this.raceResultId,
    required this.driverId,
    required this.constructorId,
    this.position,
    this.gridPosition,
    this.points,
    required this.status,
    this.laps,
    this.elapsedTimeMillis,
    this.gapToLeaderMillis,
    this.lapsBehind,
    this.fastestLap,
    this.dnfReason,
    this.gapText,
    required this.orderIndex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['race_result_id'] = Variable<String>(raceResultId);
    map['driver_id'] = Variable<String>(driverId);
    map['constructor_id'] = Variable<String>(constructorId);
    if (!nullToAbsent || position != null) {
      map['position'] = Variable<int>(position);
    }
    if (!nullToAbsent || gridPosition != null) {
      map['grid_position'] = Variable<int>(gridPosition);
    }
    if (!nullToAbsent || points != null) {
      map['points'] = Variable<double>(points);
    }
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || laps != null) {
      map['laps'] = Variable<int>(laps);
    }
    if (!nullToAbsent || elapsedTimeMillis != null) {
      map['elapsed_time_millis'] = Variable<int>(elapsedTimeMillis);
    }
    if (!nullToAbsent || gapToLeaderMillis != null) {
      map['gap_to_leader_millis'] = Variable<int>(gapToLeaderMillis);
    }
    if (!nullToAbsent || lapsBehind != null) {
      map['laps_behind'] = Variable<int>(lapsBehind);
    }
    if (!nullToAbsent || fastestLap != null) {
      map['fastest_lap'] = Variable<bool>(fastestLap);
    }
    if (!nullToAbsent || dnfReason != null) {
      map['dnf_reason'] = Variable<String>(dnfReason);
    }
    if (!nullToAbsent || gapText != null) {
      map['gap_text'] = Variable<String>(gapText);
    }
    map['order_index'] = Variable<int>(orderIndex);
    return map;
  }

  RaceResultEntriesCompanion toCompanion(bool nullToAbsent) {
    return RaceResultEntriesCompanion(
      raceResultId: Value(raceResultId),
      driverId: Value(driverId),
      constructorId: Value(constructorId),
      position: position == null && nullToAbsent
          ? const Value.absent()
          : Value(position),
      gridPosition: gridPosition == null && nullToAbsent
          ? const Value.absent()
          : Value(gridPosition),
      points: points == null && nullToAbsent
          ? const Value.absent()
          : Value(points),
      status: Value(status),
      laps: laps == null && nullToAbsent ? const Value.absent() : Value(laps),
      elapsedTimeMillis: elapsedTimeMillis == null && nullToAbsent
          ? const Value.absent()
          : Value(elapsedTimeMillis),
      gapToLeaderMillis: gapToLeaderMillis == null && nullToAbsent
          ? const Value.absent()
          : Value(gapToLeaderMillis),
      lapsBehind: lapsBehind == null && nullToAbsent
          ? const Value.absent()
          : Value(lapsBehind),
      fastestLap: fastestLap == null && nullToAbsent
          ? const Value.absent()
          : Value(fastestLap),
      dnfReason: dnfReason == null && nullToAbsent
          ? const Value.absent()
          : Value(dnfReason),
      gapText: gapText == null && nullToAbsent
          ? const Value.absent()
          : Value(gapText),
      orderIndex: Value(orderIndex),
    );
  }

  factory RaceResultEntryRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RaceResultEntryRow(
      raceResultId: serializer.fromJson<String>(json['raceResultId']),
      driverId: serializer.fromJson<String>(json['driverId']),
      constructorId: serializer.fromJson<String>(json['constructorId']),
      position: serializer.fromJson<int?>(json['position']),
      gridPosition: serializer.fromJson<int?>(json['gridPosition']),
      points: serializer.fromJson<double?>(json['points']),
      status: serializer.fromJson<String>(json['status']),
      laps: serializer.fromJson<int?>(json['laps']),
      elapsedTimeMillis: serializer.fromJson<int?>(json['elapsedTimeMillis']),
      gapToLeaderMillis: serializer.fromJson<int?>(json['gapToLeaderMillis']),
      lapsBehind: serializer.fromJson<int?>(json['lapsBehind']),
      fastestLap: serializer.fromJson<bool?>(json['fastestLap']),
      dnfReason: serializer.fromJson<String?>(json['dnfReason']),
      gapText: serializer.fromJson<String?>(json['gapText']),
      orderIndex: serializer.fromJson<int>(json['orderIndex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'raceResultId': serializer.toJson<String>(raceResultId),
      'driverId': serializer.toJson<String>(driverId),
      'constructorId': serializer.toJson<String>(constructorId),
      'position': serializer.toJson<int?>(position),
      'gridPosition': serializer.toJson<int?>(gridPosition),
      'points': serializer.toJson<double?>(points),
      'status': serializer.toJson<String>(status),
      'laps': serializer.toJson<int?>(laps),
      'elapsedTimeMillis': serializer.toJson<int?>(elapsedTimeMillis),
      'gapToLeaderMillis': serializer.toJson<int?>(gapToLeaderMillis),
      'lapsBehind': serializer.toJson<int?>(lapsBehind),
      'fastestLap': serializer.toJson<bool?>(fastestLap),
      'dnfReason': serializer.toJson<String?>(dnfReason),
      'gapText': serializer.toJson<String?>(gapText),
      'orderIndex': serializer.toJson<int>(orderIndex),
    };
  }

  RaceResultEntryRow copyWith({
    String? raceResultId,
    String? driverId,
    String? constructorId,
    Value<int?> position = const Value.absent(),
    Value<int?> gridPosition = const Value.absent(),
    Value<double?> points = const Value.absent(),
    String? status,
    Value<int?> laps = const Value.absent(),
    Value<int?> elapsedTimeMillis = const Value.absent(),
    Value<int?> gapToLeaderMillis = const Value.absent(),
    Value<int?> lapsBehind = const Value.absent(),
    Value<bool?> fastestLap = const Value.absent(),
    Value<String?> dnfReason = const Value.absent(),
    Value<String?> gapText = const Value.absent(),
    int? orderIndex,
  }) => RaceResultEntryRow(
    raceResultId: raceResultId ?? this.raceResultId,
    driverId: driverId ?? this.driverId,
    constructorId: constructorId ?? this.constructorId,
    position: position.present ? position.value : this.position,
    gridPosition: gridPosition.present ? gridPosition.value : this.gridPosition,
    points: points.present ? points.value : this.points,
    status: status ?? this.status,
    laps: laps.present ? laps.value : this.laps,
    elapsedTimeMillis: elapsedTimeMillis.present
        ? elapsedTimeMillis.value
        : this.elapsedTimeMillis,
    gapToLeaderMillis: gapToLeaderMillis.present
        ? gapToLeaderMillis.value
        : this.gapToLeaderMillis,
    lapsBehind: lapsBehind.present ? lapsBehind.value : this.lapsBehind,
    fastestLap: fastestLap.present ? fastestLap.value : this.fastestLap,
    dnfReason: dnfReason.present ? dnfReason.value : this.dnfReason,
    gapText: gapText.present ? gapText.value : this.gapText,
    orderIndex: orderIndex ?? this.orderIndex,
  );
  RaceResultEntryRow copyWithCompanion(RaceResultEntriesCompanion data) {
    return RaceResultEntryRow(
      raceResultId: data.raceResultId.present
          ? data.raceResultId.value
          : this.raceResultId,
      driverId: data.driverId.present ? data.driverId.value : this.driverId,
      constructorId: data.constructorId.present
          ? data.constructorId.value
          : this.constructorId,
      position: data.position.present ? data.position.value : this.position,
      gridPosition: data.gridPosition.present
          ? data.gridPosition.value
          : this.gridPosition,
      points: data.points.present ? data.points.value : this.points,
      status: data.status.present ? data.status.value : this.status,
      laps: data.laps.present ? data.laps.value : this.laps,
      elapsedTimeMillis: data.elapsedTimeMillis.present
          ? data.elapsedTimeMillis.value
          : this.elapsedTimeMillis,
      gapToLeaderMillis: data.gapToLeaderMillis.present
          ? data.gapToLeaderMillis.value
          : this.gapToLeaderMillis,
      lapsBehind: data.lapsBehind.present
          ? data.lapsBehind.value
          : this.lapsBehind,
      fastestLap: data.fastestLap.present
          ? data.fastestLap.value
          : this.fastestLap,
      dnfReason: data.dnfReason.present ? data.dnfReason.value : this.dnfReason,
      gapText: data.gapText.present ? data.gapText.value : this.gapText,
      orderIndex: data.orderIndex.present
          ? data.orderIndex.value
          : this.orderIndex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RaceResultEntryRow(')
          ..write('raceResultId: $raceResultId, ')
          ..write('driverId: $driverId, ')
          ..write('constructorId: $constructorId, ')
          ..write('position: $position, ')
          ..write('gridPosition: $gridPosition, ')
          ..write('points: $points, ')
          ..write('status: $status, ')
          ..write('laps: $laps, ')
          ..write('elapsedTimeMillis: $elapsedTimeMillis, ')
          ..write('gapToLeaderMillis: $gapToLeaderMillis, ')
          ..write('lapsBehind: $lapsBehind, ')
          ..write('fastestLap: $fastestLap, ')
          ..write('dnfReason: $dnfReason, ')
          ..write('gapText: $gapText, ')
          ..write('orderIndex: $orderIndex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    raceResultId,
    driverId,
    constructorId,
    position,
    gridPosition,
    points,
    status,
    laps,
    elapsedTimeMillis,
    gapToLeaderMillis,
    lapsBehind,
    fastestLap,
    dnfReason,
    gapText,
    orderIndex,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RaceResultEntryRow &&
          other.raceResultId == this.raceResultId &&
          other.driverId == this.driverId &&
          other.constructorId == this.constructorId &&
          other.position == this.position &&
          other.gridPosition == this.gridPosition &&
          other.points == this.points &&
          other.status == this.status &&
          other.laps == this.laps &&
          other.elapsedTimeMillis == this.elapsedTimeMillis &&
          other.gapToLeaderMillis == this.gapToLeaderMillis &&
          other.lapsBehind == this.lapsBehind &&
          other.fastestLap == this.fastestLap &&
          other.dnfReason == this.dnfReason &&
          other.gapText == this.gapText &&
          other.orderIndex == this.orderIndex);
}

class RaceResultEntriesCompanion extends UpdateCompanion<RaceResultEntryRow> {
  final Value<String> raceResultId;
  final Value<String> driverId;
  final Value<String> constructorId;
  final Value<int?> position;
  final Value<int?> gridPosition;
  final Value<double?> points;
  final Value<String> status;
  final Value<int?> laps;
  final Value<int?> elapsedTimeMillis;
  final Value<int?> gapToLeaderMillis;
  final Value<int?> lapsBehind;
  final Value<bool?> fastestLap;
  final Value<String?> dnfReason;
  final Value<String?> gapText;
  final Value<int> orderIndex;
  final Value<int> rowid;
  const RaceResultEntriesCompanion({
    this.raceResultId = const Value.absent(),
    this.driverId = const Value.absent(),
    this.constructorId = const Value.absent(),
    this.position = const Value.absent(),
    this.gridPosition = const Value.absent(),
    this.points = const Value.absent(),
    this.status = const Value.absent(),
    this.laps = const Value.absent(),
    this.elapsedTimeMillis = const Value.absent(),
    this.gapToLeaderMillis = const Value.absent(),
    this.lapsBehind = const Value.absent(),
    this.fastestLap = const Value.absent(),
    this.dnfReason = const Value.absent(),
    this.gapText = const Value.absent(),
    this.orderIndex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RaceResultEntriesCompanion.insert({
    required String raceResultId,
    required String driverId,
    required String constructorId,
    this.position = const Value.absent(),
    this.gridPosition = const Value.absent(),
    this.points = const Value.absent(),
    required String status,
    this.laps = const Value.absent(),
    this.elapsedTimeMillis = const Value.absent(),
    this.gapToLeaderMillis = const Value.absent(),
    this.lapsBehind = const Value.absent(),
    this.fastestLap = const Value.absent(),
    this.dnfReason = const Value.absent(),
    this.gapText = const Value.absent(),
    required int orderIndex,
    this.rowid = const Value.absent(),
  }) : raceResultId = Value(raceResultId),
       driverId = Value(driverId),
       constructorId = Value(constructorId),
       status = Value(status),
       orderIndex = Value(orderIndex);
  static Insertable<RaceResultEntryRow> custom({
    Expression<String>? raceResultId,
    Expression<String>? driverId,
    Expression<String>? constructorId,
    Expression<int>? position,
    Expression<int>? gridPosition,
    Expression<double>? points,
    Expression<String>? status,
    Expression<int>? laps,
    Expression<int>? elapsedTimeMillis,
    Expression<int>? gapToLeaderMillis,
    Expression<int>? lapsBehind,
    Expression<bool>? fastestLap,
    Expression<String>? dnfReason,
    Expression<String>? gapText,
    Expression<int>? orderIndex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (raceResultId != null) 'race_result_id': raceResultId,
      if (driverId != null) 'driver_id': driverId,
      if (constructorId != null) 'constructor_id': constructorId,
      if (position != null) 'position': position,
      if (gridPosition != null) 'grid_position': gridPosition,
      if (points != null) 'points': points,
      if (status != null) 'status': status,
      if (laps != null) 'laps': laps,
      if (elapsedTimeMillis != null) 'elapsed_time_millis': elapsedTimeMillis,
      if (gapToLeaderMillis != null) 'gap_to_leader_millis': gapToLeaderMillis,
      if (lapsBehind != null) 'laps_behind': lapsBehind,
      if (fastestLap != null) 'fastest_lap': fastestLap,
      if (dnfReason != null) 'dnf_reason': dnfReason,
      if (gapText != null) 'gap_text': gapText,
      if (orderIndex != null) 'order_index': orderIndex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RaceResultEntriesCompanion copyWith({
    Value<String>? raceResultId,
    Value<String>? driverId,
    Value<String>? constructorId,
    Value<int?>? position,
    Value<int?>? gridPosition,
    Value<double?>? points,
    Value<String>? status,
    Value<int?>? laps,
    Value<int?>? elapsedTimeMillis,
    Value<int?>? gapToLeaderMillis,
    Value<int?>? lapsBehind,
    Value<bool?>? fastestLap,
    Value<String?>? dnfReason,
    Value<String?>? gapText,
    Value<int>? orderIndex,
    Value<int>? rowid,
  }) {
    return RaceResultEntriesCompanion(
      raceResultId: raceResultId ?? this.raceResultId,
      driverId: driverId ?? this.driverId,
      constructorId: constructorId ?? this.constructorId,
      position: position ?? this.position,
      gridPosition: gridPosition ?? this.gridPosition,
      points: points ?? this.points,
      status: status ?? this.status,
      laps: laps ?? this.laps,
      elapsedTimeMillis: elapsedTimeMillis ?? this.elapsedTimeMillis,
      gapToLeaderMillis: gapToLeaderMillis ?? this.gapToLeaderMillis,
      lapsBehind: lapsBehind ?? this.lapsBehind,
      fastestLap: fastestLap ?? this.fastestLap,
      dnfReason: dnfReason ?? this.dnfReason,
      gapText: gapText ?? this.gapText,
      orderIndex: orderIndex ?? this.orderIndex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (raceResultId.present) {
      map['race_result_id'] = Variable<String>(raceResultId.value);
    }
    if (driverId.present) {
      map['driver_id'] = Variable<String>(driverId.value);
    }
    if (constructorId.present) {
      map['constructor_id'] = Variable<String>(constructorId.value);
    }
    if (position.present) {
      map['position'] = Variable<int>(position.value);
    }
    if (gridPosition.present) {
      map['grid_position'] = Variable<int>(gridPosition.value);
    }
    if (points.present) {
      map['points'] = Variable<double>(points.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (laps.present) {
      map['laps'] = Variable<int>(laps.value);
    }
    if (elapsedTimeMillis.present) {
      map['elapsed_time_millis'] = Variable<int>(elapsedTimeMillis.value);
    }
    if (gapToLeaderMillis.present) {
      map['gap_to_leader_millis'] = Variable<int>(gapToLeaderMillis.value);
    }
    if (lapsBehind.present) {
      map['laps_behind'] = Variable<int>(lapsBehind.value);
    }
    if (fastestLap.present) {
      map['fastest_lap'] = Variable<bool>(fastestLap.value);
    }
    if (dnfReason.present) {
      map['dnf_reason'] = Variable<String>(dnfReason.value);
    }
    if (gapText.present) {
      map['gap_text'] = Variable<String>(gapText.value);
    }
    if (orderIndex.present) {
      map['order_index'] = Variable<int>(orderIndex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RaceResultEntriesCompanion(')
          ..write('raceResultId: $raceResultId, ')
          ..write('driverId: $driverId, ')
          ..write('constructorId: $constructorId, ')
          ..write('position: $position, ')
          ..write('gridPosition: $gridPosition, ')
          ..write('points: $points, ')
          ..write('status: $status, ')
          ..write('laps: $laps, ')
          ..write('elapsedTimeMillis: $elapsedTimeMillis, ')
          ..write('gapToLeaderMillis: $gapToLeaderMillis, ')
          ..write('lapsBehind: $lapsBehind, ')
          ..write('fastestLap: $fastestLap, ')
          ..write('dnfReason: $dnfReason, ')
          ..write('gapText: $gapText, ')
          ..write('orderIndex: $orderIndex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $MediaAssetsTable extends MediaAssets
    with TableInfo<$MediaAssetsTable, MediaAssetRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $MediaAssetsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _entityTypeMeta = const VerificationMeta(
    'entityType',
  );
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
    'entity_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _entityIdMeta = const VerificationMeta(
    'entityId',
  );
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
    'entity_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _formatMeta = const VerificationMeta('format');
  @override
  late final GeneratedColumn<String> format = GeneratedColumn<String>(
    'format',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _aspectRatioMeta = const VerificationMeta(
    'aspectRatio',
  );
  @override
  late final GeneratedColumn<double> aspectRatio = GeneratedColumn<double>(
    'aspect_ratio',
    aliasedName,
    true,
    check: () => ComparableExpr(aspectRatio).isBiggerThanValue(0.0),
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _versionMeta = const VerificationMeta(
    'version',
  );
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
    'version',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attributionMeta = const VerificationMeta(
    'attribution',
  );
  @override
  late final GeneratedColumn<String> attribution = GeneratedColumn<String>(
    'attribution',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _licenseMeta = const VerificationMeta(
    'license',
  );
  @override
  late final GeneratedColumn<String> license = GeneratedColumn<String>(
    'license',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _fallbackCategoryMeta = const VerificationMeta(
    'fallbackCategory',
  );
  @override
  late final GeneratedColumn<String> fallbackCategory = GeneratedColumn<String>(
    'fallback_category',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    entityType,
    entityId,
    category,
    format,
    aspectRatio,
    version,
    attribution,
    license,
    fallbackCategory,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'media_assets';
  @override
  VerificationContext validateIntegrity(
    Insertable<MediaAssetRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
        _entityTypeMeta,
        entityType.isAcceptableOrUnknown(data['entity_type']!, _entityTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(
        _entityIdMeta,
        entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta),
      );
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    } else if (isInserting) {
      context.missing(_categoryMeta);
    }
    if (data.containsKey('format')) {
      context.handle(
        _formatMeta,
        format.isAcceptableOrUnknown(data['format']!, _formatMeta),
      );
    } else if (isInserting) {
      context.missing(_formatMeta);
    }
    if (data.containsKey('aspect_ratio')) {
      context.handle(
        _aspectRatioMeta,
        aspectRatio.isAcceptableOrUnknown(
          data['aspect_ratio']!,
          _aspectRatioMeta,
        ),
      );
    }
    if (data.containsKey('version')) {
      context.handle(
        _versionMeta,
        version.isAcceptableOrUnknown(data['version']!, _versionMeta),
      );
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('attribution')) {
      context.handle(
        _attributionMeta,
        attribution.isAcceptableOrUnknown(
          data['attribution']!,
          _attributionMeta,
        ),
      );
    }
    if (data.containsKey('license')) {
      context.handle(
        _licenseMeta,
        license.isAcceptableOrUnknown(data['license']!, _licenseMeta),
      );
    }
    if (data.containsKey('fallback_category')) {
      context.handle(
        _fallbackCategoryMeta,
        fallbackCategory.isAcceptableOrUnknown(
          data['fallback_category']!,
          _fallbackCategoryMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  MediaAssetRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return MediaAssetRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      entityType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_type'],
      )!,
      entityId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_id'],
      ),
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      )!,
      format: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}format'],
      )!,
      aspectRatio: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}aspect_ratio'],
      ),
      version: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}version'],
      )!,
      attribution: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attribution'],
      ),
      license: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}license'],
      ),
      fallbackCategory: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}fallback_category'],
      ),
    );
  }

  @override
  $MediaAssetsTable createAlias(String alias) {
    return $MediaAssetsTable(attachedDatabase, alias);
  }
}

class MediaAssetRow extends DataClass implements Insertable<MediaAssetRow> {
  final String id;

  /// `MediaEntityType` wire token
  /// (`driver`/`constructor`/`circuit`/`grand_prix`/`placeholder`/`unknown`).
  final String entityType;

  /// Descriptor value only; the FK-backed owner (when any) lives in the
  /// matching association table. Null/loose for `placeholder`/`unknown`.
  final String? entityId;

  /// `MediaCategory` wire token.
  final String category;

  /// `MediaFormat` wire token.
  final String format;
  final double? aspectRatio;

  /// Immutable version token, e.g. `v1`.
  final String version;
  final String? attribution;
  final String? license;

  /// Placeholder category to use when the asset is missing.
  final String? fallbackCategory;
  const MediaAssetRow({
    required this.id,
    required this.entityType,
    this.entityId,
    required this.category,
    required this.format,
    this.aspectRatio,
    required this.version,
    this.attribution,
    this.license,
    this.fallbackCategory,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['entity_type'] = Variable<String>(entityType);
    if (!nullToAbsent || entityId != null) {
      map['entity_id'] = Variable<String>(entityId);
    }
    map['category'] = Variable<String>(category);
    map['format'] = Variable<String>(format);
    if (!nullToAbsent || aspectRatio != null) {
      map['aspect_ratio'] = Variable<double>(aspectRatio);
    }
    map['version'] = Variable<String>(version);
    if (!nullToAbsent || attribution != null) {
      map['attribution'] = Variable<String>(attribution);
    }
    if (!nullToAbsent || license != null) {
      map['license'] = Variable<String>(license);
    }
    if (!nullToAbsent || fallbackCategory != null) {
      map['fallback_category'] = Variable<String>(fallbackCategory);
    }
    return map;
  }

  MediaAssetsCompanion toCompanion(bool nullToAbsent) {
    return MediaAssetsCompanion(
      id: Value(id),
      entityType: Value(entityType),
      entityId: entityId == null && nullToAbsent
          ? const Value.absent()
          : Value(entityId),
      category: Value(category),
      format: Value(format),
      aspectRatio: aspectRatio == null && nullToAbsent
          ? const Value.absent()
          : Value(aspectRatio),
      version: Value(version),
      attribution: attribution == null && nullToAbsent
          ? const Value.absent()
          : Value(attribution),
      license: license == null && nullToAbsent
          ? const Value.absent()
          : Value(license),
      fallbackCategory: fallbackCategory == null && nullToAbsent
          ? const Value.absent()
          : Value(fallbackCategory),
    );
  }

  factory MediaAssetRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return MediaAssetRow(
      id: serializer.fromJson<String>(json['id']),
      entityType: serializer.fromJson<String>(json['entityType']),
      entityId: serializer.fromJson<String?>(json['entityId']),
      category: serializer.fromJson<String>(json['category']),
      format: serializer.fromJson<String>(json['format']),
      aspectRatio: serializer.fromJson<double?>(json['aspectRatio']),
      version: serializer.fromJson<String>(json['version']),
      attribution: serializer.fromJson<String?>(json['attribution']),
      license: serializer.fromJson<String?>(json['license']),
      fallbackCategory: serializer.fromJson<String?>(json['fallbackCategory']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'entityType': serializer.toJson<String>(entityType),
      'entityId': serializer.toJson<String?>(entityId),
      'category': serializer.toJson<String>(category),
      'format': serializer.toJson<String>(format),
      'aspectRatio': serializer.toJson<double?>(aspectRatio),
      'version': serializer.toJson<String>(version),
      'attribution': serializer.toJson<String?>(attribution),
      'license': serializer.toJson<String?>(license),
      'fallbackCategory': serializer.toJson<String?>(fallbackCategory),
    };
  }

  MediaAssetRow copyWith({
    String? id,
    String? entityType,
    Value<String?> entityId = const Value.absent(),
    String? category,
    String? format,
    Value<double?> aspectRatio = const Value.absent(),
    String? version,
    Value<String?> attribution = const Value.absent(),
    Value<String?> license = const Value.absent(),
    Value<String?> fallbackCategory = const Value.absent(),
  }) => MediaAssetRow(
    id: id ?? this.id,
    entityType: entityType ?? this.entityType,
    entityId: entityId.present ? entityId.value : this.entityId,
    category: category ?? this.category,
    format: format ?? this.format,
    aspectRatio: aspectRatio.present ? aspectRatio.value : this.aspectRatio,
    version: version ?? this.version,
    attribution: attribution.present ? attribution.value : this.attribution,
    license: license.present ? license.value : this.license,
    fallbackCategory: fallbackCategory.present
        ? fallbackCategory.value
        : this.fallbackCategory,
  );
  MediaAssetRow copyWithCompanion(MediaAssetsCompanion data) {
    return MediaAssetRow(
      id: data.id.present ? data.id.value : this.id,
      entityType: data.entityType.present
          ? data.entityType.value
          : this.entityType,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      category: data.category.present ? data.category.value : this.category,
      format: data.format.present ? data.format.value : this.format,
      aspectRatio: data.aspectRatio.present
          ? data.aspectRatio.value
          : this.aspectRatio,
      version: data.version.present ? data.version.value : this.version,
      attribution: data.attribution.present
          ? data.attribution.value
          : this.attribution,
      license: data.license.present ? data.license.value : this.license,
      fallbackCategory: data.fallbackCategory.present
          ? data.fallbackCategory.value
          : this.fallbackCategory,
    );
  }

  @override
  String toString() {
    return (StringBuffer('MediaAssetRow(')
          ..write('id: $id, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('category: $category, ')
          ..write('format: $format, ')
          ..write('aspectRatio: $aspectRatio, ')
          ..write('version: $version, ')
          ..write('attribution: $attribution, ')
          ..write('license: $license, ')
          ..write('fallbackCategory: $fallbackCategory')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    entityType,
    entityId,
    category,
    format,
    aspectRatio,
    version,
    attribution,
    license,
    fallbackCategory,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is MediaAssetRow &&
          other.id == this.id &&
          other.entityType == this.entityType &&
          other.entityId == this.entityId &&
          other.category == this.category &&
          other.format == this.format &&
          other.aspectRatio == this.aspectRatio &&
          other.version == this.version &&
          other.attribution == this.attribution &&
          other.license == this.license &&
          other.fallbackCategory == this.fallbackCategory);
}

class MediaAssetsCompanion extends UpdateCompanion<MediaAssetRow> {
  final Value<String> id;
  final Value<String> entityType;
  final Value<String?> entityId;
  final Value<String> category;
  final Value<String> format;
  final Value<double?> aspectRatio;
  final Value<String> version;
  final Value<String?> attribution;
  final Value<String?> license;
  final Value<String?> fallbackCategory;
  final Value<int> rowid;
  const MediaAssetsCompanion({
    this.id = const Value.absent(),
    this.entityType = const Value.absent(),
    this.entityId = const Value.absent(),
    this.category = const Value.absent(),
    this.format = const Value.absent(),
    this.aspectRatio = const Value.absent(),
    this.version = const Value.absent(),
    this.attribution = const Value.absent(),
    this.license = const Value.absent(),
    this.fallbackCategory = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  MediaAssetsCompanion.insert({
    required String id,
    required String entityType,
    this.entityId = const Value.absent(),
    required String category,
    required String format,
    this.aspectRatio = const Value.absent(),
    required String version,
    this.attribution = const Value.absent(),
    this.license = const Value.absent(),
    this.fallbackCategory = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       entityType = Value(entityType),
       category = Value(category),
       format = Value(format),
       version = Value(version);
  static Insertable<MediaAssetRow> custom({
    Expression<String>? id,
    Expression<String>? entityType,
    Expression<String>? entityId,
    Expression<String>? category,
    Expression<String>? format,
    Expression<double>? aspectRatio,
    Expression<String>? version,
    Expression<String>? attribution,
    Expression<String>? license,
    Expression<String>? fallbackCategory,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (entityType != null) 'entity_type': entityType,
      if (entityId != null) 'entity_id': entityId,
      if (category != null) 'category': category,
      if (format != null) 'format': format,
      if (aspectRatio != null) 'aspect_ratio': aspectRatio,
      if (version != null) 'version': version,
      if (attribution != null) 'attribution': attribution,
      if (license != null) 'license': license,
      if (fallbackCategory != null) 'fallback_category': fallbackCategory,
      if (rowid != null) 'rowid': rowid,
    });
  }

  MediaAssetsCompanion copyWith({
    Value<String>? id,
    Value<String>? entityType,
    Value<String?>? entityId,
    Value<String>? category,
    Value<String>? format,
    Value<double?>? aspectRatio,
    Value<String>? version,
    Value<String?>? attribution,
    Value<String?>? license,
    Value<String?>? fallbackCategory,
    Value<int>? rowid,
  }) {
    return MediaAssetsCompanion(
      id: id ?? this.id,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      category: category ?? this.category,
      format: format ?? this.format,
      aspectRatio: aspectRatio ?? this.aspectRatio,
      version: version ?? this.version,
      attribution: attribution ?? this.attribution,
      license: license ?? this.license,
      fallbackCategory: fallbackCategory ?? this.fallbackCategory,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (format.present) {
      map['format'] = Variable<String>(format.value);
    }
    if (aspectRatio.present) {
      map['aspect_ratio'] = Variable<double>(aspectRatio.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (attribution.present) {
      map['attribution'] = Variable<String>(attribution.value);
    }
    if (license.present) {
      map['license'] = Variable<String>(license.value);
    }
    if (fallbackCategory.present) {
      map['fallback_category'] = Variable<String>(fallbackCategory.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('MediaAssetsCompanion(')
          ..write('id: $id, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('category: $category, ')
          ..write('format: $format, ')
          ..write('aspectRatio: $aspectRatio, ')
          ..write('version: $version, ')
          ..write('attribution: $attribution, ')
          ..write('license: $license, ')
          ..write('fallbackCategory: $fallbackCategory, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $MediaAssetVariantsTable extends MediaAssetVariants
    with TableInfo<$MediaAssetVariantsTable, MediaVariantRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $MediaAssetVariantsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _mediaIdMeta = const VerificationMeta(
    'mediaId',
  );
  @override
  late final GeneratedColumn<String> mediaId = GeneratedColumn<String>(
    'media_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES media_assets (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _variantNameMeta = const VerificationMeta(
    'variantName',
  );
  @override
  late final GeneratedColumn<String> variantName = GeneratedColumn<String>(
    'variant_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _urlMeta = const VerificationMeta('url');
  @override
  late final GeneratedColumn<String> url = GeneratedColumn<String>(
    'url',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _widthMeta = const VerificationMeta('width');
  @override
  late final GeneratedColumn<int> width = GeneratedColumn<int>(
    'width',
    aliasedName,
    true,
    check: () => ComparableExpr(width).isBiggerThanValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _heightMeta = const VerificationMeta('height');
  @override
  late final GeneratedColumn<int> height = GeneratedColumn<int>(
    'height',
    aliasedName,
    true,
    check: () => ComparableExpr(height).isBiggerThanValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    mediaId,
    variantName,
    url,
    width,
    height,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'media_variants';
  @override
  VerificationContext validateIntegrity(
    Insertable<MediaVariantRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('media_id')) {
      context.handle(
        _mediaIdMeta,
        mediaId.isAcceptableOrUnknown(data['media_id']!, _mediaIdMeta),
      );
    } else if (isInserting) {
      context.missing(_mediaIdMeta);
    }
    if (data.containsKey('variant_name')) {
      context.handle(
        _variantNameMeta,
        variantName.isAcceptableOrUnknown(
          data['variant_name']!,
          _variantNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_variantNameMeta);
    }
    if (data.containsKey('url')) {
      context.handle(
        _urlMeta,
        url.isAcceptableOrUnknown(data['url']!, _urlMeta),
      );
    } else if (isInserting) {
      context.missing(_urlMeta);
    }
    if (data.containsKey('width')) {
      context.handle(
        _widthMeta,
        width.isAcceptableOrUnknown(data['width']!, _widthMeta),
      );
    }
    if (data.containsKey('height')) {
      context.handle(
        _heightMeta,
        height.isAcceptableOrUnknown(data['height']!, _heightMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {mediaId, variantName};
  @override
  MediaVariantRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return MediaVariantRow(
      mediaId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}media_id'],
      )!,
      variantName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}variant_name'],
      )!,
      url: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}url'],
      )!,
      width: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}width'],
      ),
      height: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}height'],
      ),
    );
  }

  @override
  $MediaAssetVariantsTable createAlias(String alias) {
    return $MediaAssetVariantsTable(attachedDatabase, alias);
  }
}

class MediaVariantRow extends DataClass implements Insertable<MediaVariantRow> {
  /// Cascades: removing a media asset removes its variants.
  final String mediaId;
  final String variantName;
  final String url;
  final int? width;
  final int? height;
  const MediaVariantRow({
    required this.mediaId,
    required this.variantName,
    required this.url,
    this.width,
    this.height,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['media_id'] = Variable<String>(mediaId);
    map['variant_name'] = Variable<String>(variantName);
    map['url'] = Variable<String>(url);
    if (!nullToAbsent || width != null) {
      map['width'] = Variable<int>(width);
    }
    if (!nullToAbsent || height != null) {
      map['height'] = Variable<int>(height);
    }
    return map;
  }

  MediaAssetVariantsCompanion toCompanion(bool nullToAbsent) {
    return MediaAssetVariantsCompanion(
      mediaId: Value(mediaId),
      variantName: Value(variantName),
      url: Value(url),
      width: width == null && nullToAbsent
          ? const Value.absent()
          : Value(width),
      height: height == null && nullToAbsent
          ? const Value.absent()
          : Value(height),
    );
  }

  factory MediaVariantRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return MediaVariantRow(
      mediaId: serializer.fromJson<String>(json['mediaId']),
      variantName: serializer.fromJson<String>(json['variantName']),
      url: serializer.fromJson<String>(json['url']),
      width: serializer.fromJson<int?>(json['width']),
      height: serializer.fromJson<int?>(json['height']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'mediaId': serializer.toJson<String>(mediaId),
      'variantName': serializer.toJson<String>(variantName),
      'url': serializer.toJson<String>(url),
      'width': serializer.toJson<int?>(width),
      'height': serializer.toJson<int?>(height),
    };
  }

  MediaVariantRow copyWith({
    String? mediaId,
    String? variantName,
    String? url,
    Value<int?> width = const Value.absent(),
    Value<int?> height = const Value.absent(),
  }) => MediaVariantRow(
    mediaId: mediaId ?? this.mediaId,
    variantName: variantName ?? this.variantName,
    url: url ?? this.url,
    width: width.present ? width.value : this.width,
    height: height.present ? height.value : this.height,
  );
  MediaVariantRow copyWithCompanion(MediaAssetVariantsCompanion data) {
    return MediaVariantRow(
      mediaId: data.mediaId.present ? data.mediaId.value : this.mediaId,
      variantName: data.variantName.present
          ? data.variantName.value
          : this.variantName,
      url: data.url.present ? data.url.value : this.url,
      width: data.width.present ? data.width.value : this.width,
      height: data.height.present ? data.height.value : this.height,
    );
  }

  @override
  String toString() {
    return (StringBuffer('MediaVariantRow(')
          ..write('mediaId: $mediaId, ')
          ..write('variantName: $variantName, ')
          ..write('url: $url, ')
          ..write('width: $width, ')
          ..write('height: $height')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(mediaId, variantName, url, width, height);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is MediaVariantRow &&
          other.mediaId == this.mediaId &&
          other.variantName == this.variantName &&
          other.url == this.url &&
          other.width == this.width &&
          other.height == this.height);
}

class MediaAssetVariantsCompanion extends UpdateCompanion<MediaVariantRow> {
  final Value<String> mediaId;
  final Value<String> variantName;
  final Value<String> url;
  final Value<int?> width;
  final Value<int?> height;
  final Value<int> rowid;
  const MediaAssetVariantsCompanion({
    this.mediaId = const Value.absent(),
    this.variantName = const Value.absent(),
    this.url = const Value.absent(),
    this.width = const Value.absent(),
    this.height = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  MediaAssetVariantsCompanion.insert({
    required String mediaId,
    required String variantName,
    required String url,
    this.width = const Value.absent(),
    this.height = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : mediaId = Value(mediaId),
       variantName = Value(variantName),
       url = Value(url);
  static Insertable<MediaVariantRow> custom({
    Expression<String>? mediaId,
    Expression<String>? variantName,
    Expression<String>? url,
    Expression<int>? width,
    Expression<int>? height,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (mediaId != null) 'media_id': mediaId,
      if (variantName != null) 'variant_name': variantName,
      if (url != null) 'url': url,
      if (width != null) 'width': width,
      if (height != null) 'height': height,
      if (rowid != null) 'rowid': rowid,
    });
  }

  MediaAssetVariantsCompanion copyWith({
    Value<String>? mediaId,
    Value<String>? variantName,
    Value<String>? url,
    Value<int?>? width,
    Value<int?>? height,
    Value<int>? rowid,
  }) {
    return MediaAssetVariantsCompanion(
      mediaId: mediaId ?? this.mediaId,
      variantName: variantName ?? this.variantName,
      url: url ?? this.url,
      width: width ?? this.width,
      height: height ?? this.height,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (mediaId.present) {
      map['media_id'] = Variable<String>(mediaId.value);
    }
    if (variantName.present) {
      map['variant_name'] = Variable<String>(variantName.value);
    }
    if (url.present) {
      map['url'] = Variable<String>(url.value);
    }
    if (width.present) {
      map['width'] = Variable<int>(width.value);
    }
    if (height.present) {
      map['height'] = Variable<int>(height.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('MediaAssetVariantsCompanion(')
          ..write('mediaId: $mediaId, ')
          ..write('variantName: $variantName, ')
          ..write('url: $url, ')
          ..write('width: $width, ')
          ..write('height: $height, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DriverMediaTable extends DriverMedia
    with TableInfo<$DriverMediaTable, DriverMediaRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DriverMediaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _mediaIdMeta = const VerificationMeta(
    'mediaId',
  );
  @override
  late final GeneratedColumn<String> mediaId = GeneratedColumn<String>(
    'media_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES media_assets (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _driverIdMeta = const VerificationMeta(
    'driverId',
  );
  @override
  late final GeneratedColumn<String> driverId = GeneratedColumn<String>(
    'driver_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES drivers (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _orderIndexMeta = const VerificationMeta(
    'orderIndex',
  );
  @override
  late final GeneratedColumn<int> orderIndex = GeneratedColumn<int>(
    'order_index',
    aliasedName,
    false,
    check: () => ComparableExpr(orderIndex).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [mediaId, driverId, orderIndex];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'driver_media';
  @override
  VerificationContext validateIntegrity(
    Insertable<DriverMediaRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('media_id')) {
      context.handle(
        _mediaIdMeta,
        mediaId.isAcceptableOrUnknown(data['media_id']!, _mediaIdMeta),
      );
    } else if (isInserting) {
      context.missing(_mediaIdMeta);
    }
    if (data.containsKey('driver_id')) {
      context.handle(
        _driverIdMeta,
        driverId.isAcceptableOrUnknown(data['driver_id']!, _driverIdMeta),
      );
    } else if (isInserting) {
      context.missing(_driverIdMeta);
    }
    if (data.containsKey('order_index')) {
      context.handle(
        _orderIndexMeta,
        orderIndex.isAcceptableOrUnknown(data['order_index']!, _orderIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIndexMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {mediaId};
  @override
  DriverMediaRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DriverMediaRow(
      mediaId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}media_id'],
      )!,
      driverId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}driver_id'],
      )!,
      orderIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}order_index'],
      )!,
    );
  }

  @override
  $DriverMediaTable createAlias(String alias) {
    return $DriverMediaTable(attachedDatabase, alias);
  }
}

class DriverMediaRow extends DataClass implements Insertable<DriverMediaRow> {
  final String mediaId;
  final String driverId;
  final int orderIndex;
  const DriverMediaRow({
    required this.mediaId,
    required this.driverId,
    required this.orderIndex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['media_id'] = Variable<String>(mediaId);
    map['driver_id'] = Variable<String>(driverId);
    map['order_index'] = Variable<int>(orderIndex);
    return map;
  }

  DriverMediaCompanion toCompanion(bool nullToAbsent) {
    return DriverMediaCompanion(
      mediaId: Value(mediaId),
      driverId: Value(driverId),
      orderIndex: Value(orderIndex),
    );
  }

  factory DriverMediaRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DriverMediaRow(
      mediaId: serializer.fromJson<String>(json['mediaId']),
      driverId: serializer.fromJson<String>(json['driverId']),
      orderIndex: serializer.fromJson<int>(json['orderIndex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'mediaId': serializer.toJson<String>(mediaId),
      'driverId': serializer.toJson<String>(driverId),
      'orderIndex': serializer.toJson<int>(orderIndex),
    };
  }

  DriverMediaRow copyWith({
    String? mediaId,
    String? driverId,
    int? orderIndex,
  }) => DriverMediaRow(
    mediaId: mediaId ?? this.mediaId,
    driverId: driverId ?? this.driverId,
    orderIndex: orderIndex ?? this.orderIndex,
  );
  DriverMediaRow copyWithCompanion(DriverMediaCompanion data) {
    return DriverMediaRow(
      mediaId: data.mediaId.present ? data.mediaId.value : this.mediaId,
      driverId: data.driverId.present ? data.driverId.value : this.driverId,
      orderIndex: data.orderIndex.present
          ? data.orderIndex.value
          : this.orderIndex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DriverMediaRow(')
          ..write('mediaId: $mediaId, ')
          ..write('driverId: $driverId, ')
          ..write('orderIndex: $orderIndex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(mediaId, driverId, orderIndex);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DriverMediaRow &&
          other.mediaId == this.mediaId &&
          other.driverId == this.driverId &&
          other.orderIndex == this.orderIndex);
}

class DriverMediaCompanion extends UpdateCompanion<DriverMediaRow> {
  final Value<String> mediaId;
  final Value<String> driverId;
  final Value<int> orderIndex;
  final Value<int> rowid;
  const DriverMediaCompanion({
    this.mediaId = const Value.absent(),
    this.driverId = const Value.absent(),
    this.orderIndex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DriverMediaCompanion.insert({
    required String mediaId,
    required String driverId,
    required int orderIndex,
    this.rowid = const Value.absent(),
  }) : mediaId = Value(mediaId),
       driverId = Value(driverId),
       orderIndex = Value(orderIndex);
  static Insertable<DriverMediaRow> custom({
    Expression<String>? mediaId,
    Expression<String>? driverId,
    Expression<int>? orderIndex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (mediaId != null) 'media_id': mediaId,
      if (driverId != null) 'driver_id': driverId,
      if (orderIndex != null) 'order_index': orderIndex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DriverMediaCompanion copyWith({
    Value<String>? mediaId,
    Value<String>? driverId,
    Value<int>? orderIndex,
    Value<int>? rowid,
  }) {
    return DriverMediaCompanion(
      mediaId: mediaId ?? this.mediaId,
      driverId: driverId ?? this.driverId,
      orderIndex: orderIndex ?? this.orderIndex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (mediaId.present) {
      map['media_id'] = Variable<String>(mediaId.value);
    }
    if (driverId.present) {
      map['driver_id'] = Variable<String>(driverId.value);
    }
    if (orderIndex.present) {
      map['order_index'] = Variable<int>(orderIndex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DriverMediaCompanion(')
          ..write('mediaId: $mediaId, ')
          ..write('driverId: $driverId, ')
          ..write('orderIndex: $orderIndex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ConstructorMediaTable extends ConstructorMedia
    with TableInfo<$ConstructorMediaTable, ConstructorMediaRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ConstructorMediaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _mediaIdMeta = const VerificationMeta(
    'mediaId',
  );
  @override
  late final GeneratedColumn<String> mediaId = GeneratedColumn<String>(
    'media_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES media_assets (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _constructorIdMeta = const VerificationMeta(
    'constructorId',
  );
  @override
  late final GeneratedColumn<String> constructorId = GeneratedColumn<String>(
    'constructor_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES constructors (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _orderIndexMeta = const VerificationMeta(
    'orderIndex',
  );
  @override
  late final GeneratedColumn<int> orderIndex = GeneratedColumn<int>(
    'order_index',
    aliasedName,
    false,
    check: () => ComparableExpr(orderIndex).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [mediaId, constructorId, orderIndex];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'constructor_media';
  @override
  VerificationContext validateIntegrity(
    Insertable<ConstructorMediaRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('media_id')) {
      context.handle(
        _mediaIdMeta,
        mediaId.isAcceptableOrUnknown(data['media_id']!, _mediaIdMeta),
      );
    } else if (isInserting) {
      context.missing(_mediaIdMeta);
    }
    if (data.containsKey('constructor_id')) {
      context.handle(
        _constructorIdMeta,
        constructorId.isAcceptableOrUnknown(
          data['constructor_id']!,
          _constructorIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_constructorIdMeta);
    }
    if (data.containsKey('order_index')) {
      context.handle(
        _orderIndexMeta,
        orderIndex.isAcceptableOrUnknown(data['order_index']!, _orderIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIndexMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {mediaId};
  @override
  ConstructorMediaRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ConstructorMediaRow(
      mediaId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}media_id'],
      )!,
      constructorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}constructor_id'],
      )!,
      orderIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}order_index'],
      )!,
    );
  }

  @override
  $ConstructorMediaTable createAlias(String alias) {
    return $ConstructorMediaTable(attachedDatabase, alias);
  }
}

class ConstructorMediaRow extends DataClass
    implements Insertable<ConstructorMediaRow> {
  final String mediaId;
  final String constructorId;
  final int orderIndex;
  const ConstructorMediaRow({
    required this.mediaId,
    required this.constructorId,
    required this.orderIndex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['media_id'] = Variable<String>(mediaId);
    map['constructor_id'] = Variable<String>(constructorId);
    map['order_index'] = Variable<int>(orderIndex);
    return map;
  }

  ConstructorMediaCompanion toCompanion(bool nullToAbsent) {
    return ConstructorMediaCompanion(
      mediaId: Value(mediaId),
      constructorId: Value(constructorId),
      orderIndex: Value(orderIndex),
    );
  }

  factory ConstructorMediaRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ConstructorMediaRow(
      mediaId: serializer.fromJson<String>(json['mediaId']),
      constructorId: serializer.fromJson<String>(json['constructorId']),
      orderIndex: serializer.fromJson<int>(json['orderIndex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'mediaId': serializer.toJson<String>(mediaId),
      'constructorId': serializer.toJson<String>(constructorId),
      'orderIndex': serializer.toJson<int>(orderIndex),
    };
  }

  ConstructorMediaRow copyWith({
    String? mediaId,
    String? constructorId,
    int? orderIndex,
  }) => ConstructorMediaRow(
    mediaId: mediaId ?? this.mediaId,
    constructorId: constructorId ?? this.constructorId,
    orderIndex: orderIndex ?? this.orderIndex,
  );
  ConstructorMediaRow copyWithCompanion(ConstructorMediaCompanion data) {
    return ConstructorMediaRow(
      mediaId: data.mediaId.present ? data.mediaId.value : this.mediaId,
      constructorId: data.constructorId.present
          ? data.constructorId.value
          : this.constructorId,
      orderIndex: data.orderIndex.present
          ? data.orderIndex.value
          : this.orderIndex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ConstructorMediaRow(')
          ..write('mediaId: $mediaId, ')
          ..write('constructorId: $constructorId, ')
          ..write('orderIndex: $orderIndex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(mediaId, constructorId, orderIndex);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ConstructorMediaRow &&
          other.mediaId == this.mediaId &&
          other.constructorId == this.constructorId &&
          other.orderIndex == this.orderIndex);
}

class ConstructorMediaCompanion extends UpdateCompanion<ConstructorMediaRow> {
  final Value<String> mediaId;
  final Value<String> constructorId;
  final Value<int> orderIndex;
  final Value<int> rowid;
  const ConstructorMediaCompanion({
    this.mediaId = const Value.absent(),
    this.constructorId = const Value.absent(),
    this.orderIndex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ConstructorMediaCompanion.insert({
    required String mediaId,
    required String constructorId,
    required int orderIndex,
    this.rowid = const Value.absent(),
  }) : mediaId = Value(mediaId),
       constructorId = Value(constructorId),
       orderIndex = Value(orderIndex);
  static Insertable<ConstructorMediaRow> custom({
    Expression<String>? mediaId,
    Expression<String>? constructorId,
    Expression<int>? orderIndex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (mediaId != null) 'media_id': mediaId,
      if (constructorId != null) 'constructor_id': constructorId,
      if (orderIndex != null) 'order_index': orderIndex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ConstructorMediaCompanion copyWith({
    Value<String>? mediaId,
    Value<String>? constructorId,
    Value<int>? orderIndex,
    Value<int>? rowid,
  }) {
    return ConstructorMediaCompanion(
      mediaId: mediaId ?? this.mediaId,
      constructorId: constructorId ?? this.constructorId,
      orderIndex: orderIndex ?? this.orderIndex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (mediaId.present) {
      map['media_id'] = Variable<String>(mediaId.value);
    }
    if (constructorId.present) {
      map['constructor_id'] = Variable<String>(constructorId.value);
    }
    if (orderIndex.present) {
      map['order_index'] = Variable<int>(orderIndex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ConstructorMediaCompanion(')
          ..write('mediaId: $mediaId, ')
          ..write('constructorId: $constructorId, ')
          ..write('orderIndex: $orderIndex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CircuitMediaTable extends CircuitMedia
    with TableInfo<$CircuitMediaTable, CircuitMediaRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CircuitMediaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _mediaIdMeta = const VerificationMeta(
    'mediaId',
  );
  @override
  late final GeneratedColumn<String> mediaId = GeneratedColumn<String>(
    'media_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES media_assets (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _circuitIdMeta = const VerificationMeta(
    'circuitId',
  );
  @override
  late final GeneratedColumn<String> circuitId = GeneratedColumn<String>(
    'circuit_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES circuits (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _orderIndexMeta = const VerificationMeta(
    'orderIndex',
  );
  @override
  late final GeneratedColumn<int> orderIndex = GeneratedColumn<int>(
    'order_index',
    aliasedName,
    false,
    check: () => ComparableExpr(orderIndex).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [mediaId, circuitId, orderIndex];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'circuit_media';
  @override
  VerificationContext validateIntegrity(
    Insertable<CircuitMediaRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('media_id')) {
      context.handle(
        _mediaIdMeta,
        mediaId.isAcceptableOrUnknown(data['media_id']!, _mediaIdMeta),
      );
    } else if (isInserting) {
      context.missing(_mediaIdMeta);
    }
    if (data.containsKey('circuit_id')) {
      context.handle(
        _circuitIdMeta,
        circuitId.isAcceptableOrUnknown(data['circuit_id']!, _circuitIdMeta),
      );
    } else if (isInserting) {
      context.missing(_circuitIdMeta);
    }
    if (data.containsKey('order_index')) {
      context.handle(
        _orderIndexMeta,
        orderIndex.isAcceptableOrUnknown(data['order_index']!, _orderIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIndexMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {mediaId};
  @override
  CircuitMediaRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CircuitMediaRow(
      mediaId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}media_id'],
      )!,
      circuitId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}circuit_id'],
      )!,
      orderIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}order_index'],
      )!,
    );
  }

  @override
  $CircuitMediaTable createAlias(String alias) {
    return $CircuitMediaTable(attachedDatabase, alias);
  }
}

class CircuitMediaRow extends DataClass implements Insertable<CircuitMediaRow> {
  final String mediaId;
  final String circuitId;
  final int orderIndex;
  const CircuitMediaRow({
    required this.mediaId,
    required this.circuitId,
    required this.orderIndex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['media_id'] = Variable<String>(mediaId);
    map['circuit_id'] = Variable<String>(circuitId);
    map['order_index'] = Variable<int>(orderIndex);
    return map;
  }

  CircuitMediaCompanion toCompanion(bool nullToAbsent) {
    return CircuitMediaCompanion(
      mediaId: Value(mediaId),
      circuitId: Value(circuitId),
      orderIndex: Value(orderIndex),
    );
  }

  factory CircuitMediaRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CircuitMediaRow(
      mediaId: serializer.fromJson<String>(json['mediaId']),
      circuitId: serializer.fromJson<String>(json['circuitId']),
      orderIndex: serializer.fromJson<int>(json['orderIndex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'mediaId': serializer.toJson<String>(mediaId),
      'circuitId': serializer.toJson<String>(circuitId),
      'orderIndex': serializer.toJson<int>(orderIndex),
    };
  }

  CircuitMediaRow copyWith({
    String? mediaId,
    String? circuitId,
    int? orderIndex,
  }) => CircuitMediaRow(
    mediaId: mediaId ?? this.mediaId,
    circuitId: circuitId ?? this.circuitId,
    orderIndex: orderIndex ?? this.orderIndex,
  );
  CircuitMediaRow copyWithCompanion(CircuitMediaCompanion data) {
    return CircuitMediaRow(
      mediaId: data.mediaId.present ? data.mediaId.value : this.mediaId,
      circuitId: data.circuitId.present ? data.circuitId.value : this.circuitId,
      orderIndex: data.orderIndex.present
          ? data.orderIndex.value
          : this.orderIndex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CircuitMediaRow(')
          ..write('mediaId: $mediaId, ')
          ..write('circuitId: $circuitId, ')
          ..write('orderIndex: $orderIndex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(mediaId, circuitId, orderIndex);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CircuitMediaRow &&
          other.mediaId == this.mediaId &&
          other.circuitId == this.circuitId &&
          other.orderIndex == this.orderIndex);
}

class CircuitMediaCompanion extends UpdateCompanion<CircuitMediaRow> {
  final Value<String> mediaId;
  final Value<String> circuitId;
  final Value<int> orderIndex;
  final Value<int> rowid;
  const CircuitMediaCompanion({
    this.mediaId = const Value.absent(),
    this.circuitId = const Value.absent(),
    this.orderIndex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CircuitMediaCompanion.insert({
    required String mediaId,
    required String circuitId,
    required int orderIndex,
    this.rowid = const Value.absent(),
  }) : mediaId = Value(mediaId),
       circuitId = Value(circuitId),
       orderIndex = Value(orderIndex);
  static Insertable<CircuitMediaRow> custom({
    Expression<String>? mediaId,
    Expression<String>? circuitId,
    Expression<int>? orderIndex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (mediaId != null) 'media_id': mediaId,
      if (circuitId != null) 'circuit_id': circuitId,
      if (orderIndex != null) 'order_index': orderIndex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CircuitMediaCompanion copyWith({
    Value<String>? mediaId,
    Value<String>? circuitId,
    Value<int>? orderIndex,
    Value<int>? rowid,
  }) {
    return CircuitMediaCompanion(
      mediaId: mediaId ?? this.mediaId,
      circuitId: circuitId ?? this.circuitId,
      orderIndex: orderIndex ?? this.orderIndex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (mediaId.present) {
      map['media_id'] = Variable<String>(mediaId.value);
    }
    if (circuitId.present) {
      map['circuit_id'] = Variable<String>(circuitId.value);
    }
    if (orderIndex.present) {
      map['order_index'] = Variable<int>(orderIndex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CircuitMediaCompanion(')
          ..write('mediaId: $mediaId, ')
          ..write('circuitId: $circuitId, ')
          ..write('orderIndex: $orderIndex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $GrandPrixMediaTable extends GrandPrixMedia
    with TableInfo<$GrandPrixMediaTable, GrandPrixMediaRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $GrandPrixMediaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _mediaIdMeta = const VerificationMeta(
    'mediaId',
  );
  @override
  late final GeneratedColumn<String> mediaId = GeneratedColumn<String>(
    'media_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES media_assets (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _grandPrixIdMeta = const VerificationMeta(
    'grandPrixId',
  );
  @override
  late final GeneratedColumn<String> grandPrixId = GeneratedColumn<String>(
    'grand_prix_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES grand_prix (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _orderIndexMeta = const VerificationMeta(
    'orderIndex',
  );
  @override
  late final GeneratedColumn<int> orderIndex = GeneratedColumn<int>(
    'order_index',
    aliasedName,
    false,
    check: () => ComparableExpr(orderIndex).isBiggerOrEqualValue(0),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [mediaId, grandPrixId, orderIndex];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'grand_prix_media';
  @override
  VerificationContext validateIntegrity(
    Insertable<GrandPrixMediaRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('media_id')) {
      context.handle(
        _mediaIdMeta,
        mediaId.isAcceptableOrUnknown(data['media_id']!, _mediaIdMeta),
      );
    } else if (isInserting) {
      context.missing(_mediaIdMeta);
    }
    if (data.containsKey('grand_prix_id')) {
      context.handle(
        _grandPrixIdMeta,
        grandPrixId.isAcceptableOrUnknown(
          data['grand_prix_id']!,
          _grandPrixIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_grandPrixIdMeta);
    }
    if (data.containsKey('order_index')) {
      context.handle(
        _orderIndexMeta,
        orderIndex.isAcceptableOrUnknown(data['order_index']!, _orderIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIndexMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {mediaId};
  @override
  GrandPrixMediaRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return GrandPrixMediaRow(
      mediaId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}media_id'],
      )!,
      grandPrixId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}grand_prix_id'],
      )!,
      orderIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}order_index'],
      )!,
    );
  }

  @override
  $GrandPrixMediaTable createAlias(String alias) {
    return $GrandPrixMediaTable(attachedDatabase, alias);
  }
}

class GrandPrixMediaRow extends DataClass
    implements Insertable<GrandPrixMediaRow> {
  final String mediaId;
  final String grandPrixId;
  final int orderIndex;
  const GrandPrixMediaRow({
    required this.mediaId,
    required this.grandPrixId,
    required this.orderIndex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['media_id'] = Variable<String>(mediaId);
    map['grand_prix_id'] = Variable<String>(grandPrixId);
    map['order_index'] = Variable<int>(orderIndex);
    return map;
  }

  GrandPrixMediaCompanion toCompanion(bool nullToAbsent) {
    return GrandPrixMediaCompanion(
      mediaId: Value(mediaId),
      grandPrixId: Value(grandPrixId),
      orderIndex: Value(orderIndex),
    );
  }

  factory GrandPrixMediaRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return GrandPrixMediaRow(
      mediaId: serializer.fromJson<String>(json['mediaId']),
      grandPrixId: serializer.fromJson<String>(json['grandPrixId']),
      orderIndex: serializer.fromJson<int>(json['orderIndex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'mediaId': serializer.toJson<String>(mediaId),
      'grandPrixId': serializer.toJson<String>(grandPrixId),
      'orderIndex': serializer.toJson<int>(orderIndex),
    };
  }

  GrandPrixMediaRow copyWith({
    String? mediaId,
    String? grandPrixId,
    int? orderIndex,
  }) => GrandPrixMediaRow(
    mediaId: mediaId ?? this.mediaId,
    grandPrixId: grandPrixId ?? this.grandPrixId,
    orderIndex: orderIndex ?? this.orderIndex,
  );
  GrandPrixMediaRow copyWithCompanion(GrandPrixMediaCompanion data) {
    return GrandPrixMediaRow(
      mediaId: data.mediaId.present ? data.mediaId.value : this.mediaId,
      grandPrixId: data.grandPrixId.present
          ? data.grandPrixId.value
          : this.grandPrixId,
      orderIndex: data.orderIndex.present
          ? data.orderIndex.value
          : this.orderIndex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('GrandPrixMediaRow(')
          ..write('mediaId: $mediaId, ')
          ..write('grandPrixId: $grandPrixId, ')
          ..write('orderIndex: $orderIndex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(mediaId, grandPrixId, orderIndex);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is GrandPrixMediaRow &&
          other.mediaId == this.mediaId &&
          other.grandPrixId == this.grandPrixId &&
          other.orderIndex == this.orderIndex);
}

class GrandPrixMediaCompanion extends UpdateCompanion<GrandPrixMediaRow> {
  final Value<String> mediaId;
  final Value<String> grandPrixId;
  final Value<int> orderIndex;
  final Value<int> rowid;
  const GrandPrixMediaCompanion({
    this.mediaId = const Value.absent(),
    this.grandPrixId = const Value.absent(),
    this.orderIndex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  GrandPrixMediaCompanion.insert({
    required String mediaId,
    required String grandPrixId,
    required int orderIndex,
    this.rowid = const Value.absent(),
  }) : mediaId = Value(mediaId),
       grandPrixId = Value(grandPrixId),
       orderIndex = Value(orderIndex);
  static Insertable<GrandPrixMediaRow> custom({
    Expression<String>? mediaId,
    Expression<String>? grandPrixId,
    Expression<int>? orderIndex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (mediaId != null) 'media_id': mediaId,
      if (grandPrixId != null) 'grand_prix_id': grandPrixId,
      if (orderIndex != null) 'order_index': orderIndex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  GrandPrixMediaCompanion copyWith({
    Value<String>? mediaId,
    Value<String>? grandPrixId,
    Value<int>? orderIndex,
    Value<int>? rowid,
  }) {
    return GrandPrixMediaCompanion(
      mediaId: mediaId ?? this.mediaId,
      grandPrixId: grandPrixId ?? this.grandPrixId,
      orderIndex: orderIndex ?? this.orderIndex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (mediaId.present) {
      map['media_id'] = Variable<String>(mediaId.value);
    }
    if (grandPrixId.present) {
      map['grand_prix_id'] = Variable<String>(grandPrixId.value);
    }
    if (orderIndex.present) {
      map['order_index'] = Variable<int>(orderIndex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('GrandPrixMediaCompanion(')
          ..write('mediaId: $mediaId, ')
          ..write('grandPrixId: $grandPrixId, ')
          ..write('orderIndex: $orderIndex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ResourceSyncMetadataTable extends ResourceSyncMetadata
    with TableInfo<$ResourceSyncMetadataTable, ResourceSyncMetadataRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ResourceSyncMetadataTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _resourceKeyMeta = const VerificationMeta(
    'resourceKey',
  );
  @override
  late final GeneratedColumn<String> resourceKey = GeneratedColumn<String>(
    'resource_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _seasonMeta = const VerificationMeta('season');
  @override
  late final GeneratedColumn<int> season = GeneratedColumn<int>(
    'season',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _entityIdMeta = const VerificationMeta(
    'entityId',
  );
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
    'entity_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _roundMeta = const VerificationMeta('round');
  @override
  late final GeneratedColumn<int> round = GeneratedColumn<int>(
    'round',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _etagMeta = const VerificationMeta('etag');
  @override
  late final GeneratedColumn<String> etag = GeneratedColumn<String>(
    'etag',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _generatedAtMeta = const VerificationMeta(
    'generatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> generatedAt = GeneratedColumn<DateTime>(
    'generated_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceUpdatedAtMeta = const VerificationMeta(
    'sourceUpdatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> sourceUpdatedAt =
      GeneratedColumn<DateTime>(
        'source_updated_at',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _staleAfterMeta = const VerificationMeta(
    'staleAfter',
  );
  @override
  late final GeneratedColumn<DateTime> staleAfter = GeneratedColumn<DateTime>(
    'stale_after',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _contentVersionMeta = const VerificationMeta(
    'contentVersion',
  );
  @override
  late final GeneratedColumn<String> contentVersion = GeneratedColumn<String>(
    'content_version',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastAttemptAtMeta = const VerificationMeta(
    'lastAttemptAt',
  );
  @override
  late final GeneratedColumn<DateTime> lastAttemptAt =
      GeneratedColumn<DateTime>(
        'last_attempt_at',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _lastSuccessAtMeta = const VerificationMeta(
    'lastSuccessAt',
  );
  @override
  late final GeneratedColumn<DateTime> lastSuccessAt =
      GeneratedColumn<DateTime>(
        'last_success_at',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _lastFailureCategoryMeta =
      const VerificationMeta('lastFailureCategory');
  @override
  late final GeneratedColumn<String> lastFailureCategory =
      GeneratedColumn<String>(
        'last_failure_category',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _serverStaleMeta = const VerificationMeta(
    'serverStale',
  );
  @override
  late final GeneratedColumn<bool> serverStale = GeneratedColumn<bool>(
    'server_stale',
    aliasedName,
    true,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("server_stale" IN (0, 1))',
    ),
  );
  @override
  List<GeneratedColumn> get $columns => [
    resourceKey,
    season,
    entityId,
    round,
    etag,
    generatedAt,
    sourceUpdatedAt,
    staleAfter,
    contentVersion,
    lastAttemptAt,
    lastSuccessAt,
    lastFailureCategory,
    serverStale,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'resource_sync_metadata';
  @override
  VerificationContext validateIntegrity(
    Insertable<ResourceSyncMetadataRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('resource_key')) {
      context.handle(
        _resourceKeyMeta,
        resourceKey.isAcceptableOrUnknown(
          data['resource_key']!,
          _resourceKeyMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_resourceKeyMeta);
    }
    if (data.containsKey('season')) {
      context.handle(
        _seasonMeta,
        season.isAcceptableOrUnknown(data['season']!, _seasonMeta),
      );
    }
    if (data.containsKey('entity_id')) {
      context.handle(
        _entityIdMeta,
        entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta),
      );
    }
    if (data.containsKey('round')) {
      context.handle(
        _roundMeta,
        round.isAcceptableOrUnknown(data['round']!, _roundMeta),
      );
    }
    if (data.containsKey('etag')) {
      context.handle(
        _etagMeta,
        etag.isAcceptableOrUnknown(data['etag']!, _etagMeta),
      );
    }
    if (data.containsKey('generated_at')) {
      context.handle(
        _generatedAtMeta,
        generatedAt.isAcceptableOrUnknown(
          data['generated_at']!,
          _generatedAtMeta,
        ),
      );
    }
    if (data.containsKey('source_updated_at')) {
      context.handle(
        _sourceUpdatedAtMeta,
        sourceUpdatedAt.isAcceptableOrUnknown(
          data['source_updated_at']!,
          _sourceUpdatedAtMeta,
        ),
      );
    }
    if (data.containsKey('stale_after')) {
      context.handle(
        _staleAfterMeta,
        staleAfter.isAcceptableOrUnknown(data['stale_after']!, _staleAfterMeta),
      );
    }
    if (data.containsKey('content_version')) {
      context.handle(
        _contentVersionMeta,
        contentVersion.isAcceptableOrUnknown(
          data['content_version']!,
          _contentVersionMeta,
        ),
      );
    }
    if (data.containsKey('last_attempt_at')) {
      context.handle(
        _lastAttemptAtMeta,
        lastAttemptAt.isAcceptableOrUnknown(
          data['last_attempt_at']!,
          _lastAttemptAtMeta,
        ),
      );
    }
    if (data.containsKey('last_success_at')) {
      context.handle(
        _lastSuccessAtMeta,
        lastSuccessAt.isAcceptableOrUnknown(
          data['last_success_at']!,
          _lastSuccessAtMeta,
        ),
      );
    }
    if (data.containsKey('last_failure_category')) {
      context.handle(
        _lastFailureCategoryMeta,
        lastFailureCategory.isAcceptableOrUnknown(
          data['last_failure_category']!,
          _lastFailureCategoryMeta,
        ),
      );
    }
    if (data.containsKey('server_stale')) {
      context.handle(
        _serverStaleMeta,
        serverStale.isAcceptableOrUnknown(
          data['server_stale']!,
          _serverStaleMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {resourceKey};
  @override
  ResourceSyncMetadataRow map(
    Map<String, dynamic> data, {
    String? tablePrefix,
  }) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ResourceSyncMetadataRow(
      resourceKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}resource_key'],
      )!,
      season: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}season'],
      ),
      entityId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_id'],
      ),
      round: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}round'],
      ),
      etag: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}etag'],
      ),
      generatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}generated_at'],
      ),
      sourceUpdatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}source_updated_at'],
      ),
      staleAfter: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}stale_after'],
      ),
      contentVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content_version'],
      ),
      lastAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_attempt_at'],
      ),
      lastSuccessAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_success_at'],
      ),
      lastFailureCategory: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_failure_category'],
      ),
      serverStale: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}server_stale'],
      ),
    );
  }

  @override
  $ResourceSyncMetadataTable createAlias(String alias) {
    return $ResourceSyncMetadataTable(attachedDatabase, alias);
  }
}

class ResourceSyncMetadataRow extends DataClass
    implements Insertable<ResourceSyncMetadataRow> {
  /// Canonical resource key (stable identifiers only, never a display name).
  final String resourceKey;
  final int? season;

  /// The scoped entity slug (driver/constructor/circuit/grand-prix), when the
  /// resource is entity-scoped.
  final String? entityId;
  final int? round;

  /// Strong or weak validator returned by the API, persisted verbatim for
  /// conditional (`If-None-Match`) requests.
  final String? etag;

  /// Snapshot provenance mirrored from the response `meta` (UTC instants).
  final DateTime? generatedAt;
  final DateTime? sourceUpdatedAt;
  final DateTime? staleAfter;
  final String? contentVersion;

  /// When synchronization of this resource was last attempted (UTC).
  final DateTime? lastAttemptAt;

  /// When this resource last synchronized successfully (UTC).
  final DateTime? lastSuccessAt;

  /// Category of the last failure (e.g. `upstream_unavailable`, `invalid`,
  /// `network`), when the last attempt failed. Never a raw error message.
  final String? lastFailureCategory;

  /// Server-provided stale flag, when supplied.
  final bool? serverStale;
  const ResourceSyncMetadataRow({
    required this.resourceKey,
    this.season,
    this.entityId,
    this.round,
    this.etag,
    this.generatedAt,
    this.sourceUpdatedAt,
    this.staleAfter,
    this.contentVersion,
    this.lastAttemptAt,
    this.lastSuccessAt,
    this.lastFailureCategory,
    this.serverStale,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['resource_key'] = Variable<String>(resourceKey);
    if (!nullToAbsent || season != null) {
      map['season'] = Variable<int>(season);
    }
    if (!nullToAbsent || entityId != null) {
      map['entity_id'] = Variable<String>(entityId);
    }
    if (!nullToAbsent || round != null) {
      map['round'] = Variable<int>(round);
    }
    if (!nullToAbsent || etag != null) {
      map['etag'] = Variable<String>(etag);
    }
    if (!nullToAbsent || generatedAt != null) {
      map['generated_at'] = Variable<DateTime>(generatedAt);
    }
    if (!nullToAbsent || sourceUpdatedAt != null) {
      map['source_updated_at'] = Variable<DateTime>(sourceUpdatedAt);
    }
    if (!nullToAbsent || staleAfter != null) {
      map['stale_after'] = Variable<DateTime>(staleAfter);
    }
    if (!nullToAbsent || contentVersion != null) {
      map['content_version'] = Variable<String>(contentVersion);
    }
    if (!nullToAbsent || lastAttemptAt != null) {
      map['last_attempt_at'] = Variable<DateTime>(lastAttemptAt);
    }
    if (!nullToAbsent || lastSuccessAt != null) {
      map['last_success_at'] = Variable<DateTime>(lastSuccessAt);
    }
    if (!nullToAbsent || lastFailureCategory != null) {
      map['last_failure_category'] = Variable<String>(lastFailureCategory);
    }
    if (!nullToAbsent || serverStale != null) {
      map['server_stale'] = Variable<bool>(serverStale);
    }
    return map;
  }

  ResourceSyncMetadataCompanion toCompanion(bool nullToAbsent) {
    return ResourceSyncMetadataCompanion(
      resourceKey: Value(resourceKey),
      season: season == null && nullToAbsent
          ? const Value.absent()
          : Value(season),
      entityId: entityId == null && nullToAbsent
          ? const Value.absent()
          : Value(entityId),
      round: round == null && nullToAbsent
          ? const Value.absent()
          : Value(round),
      etag: etag == null && nullToAbsent ? const Value.absent() : Value(etag),
      generatedAt: generatedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(generatedAt),
      sourceUpdatedAt: sourceUpdatedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(sourceUpdatedAt),
      staleAfter: staleAfter == null && nullToAbsent
          ? const Value.absent()
          : Value(staleAfter),
      contentVersion: contentVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(contentVersion),
      lastAttemptAt: lastAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastAttemptAt),
      lastSuccessAt: lastSuccessAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSuccessAt),
      lastFailureCategory: lastFailureCategory == null && nullToAbsent
          ? const Value.absent()
          : Value(lastFailureCategory),
      serverStale: serverStale == null && nullToAbsent
          ? const Value.absent()
          : Value(serverStale),
    );
  }

  factory ResourceSyncMetadataRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ResourceSyncMetadataRow(
      resourceKey: serializer.fromJson<String>(json['resourceKey']),
      season: serializer.fromJson<int?>(json['season']),
      entityId: serializer.fromJson<String?>(json['entityId']),
      round: serializer.fromJson<int?>(json['round']),
      etag: serializer.fromJson<String?>(json['etag']),
      generatedAt: serializer.fromJson<DateTime?>(json['generatedAt']),
      sourceUpdatedAt: serializer.fromJson<DateTime?>(json['sourceUpdatedAt']),
      staleAfter: serializer.fromJson<DateTime?>(json['staleAfter']),
      contentVersion: serializer.fromJson<String?>(json['contentVersion']),
      lastAttemptAt: serializer.fromJson<DateTime?>(json['lastAttemptAt']),
      lastSuccessAt: serializer.fromJson<DateTime?>(json['lastSuccessAt']),
      lastFailureCategory: serializer.fromJson<String?>(
        json['lastFailureCategory'],
      ),
      serverStale: serializer.fromJson<bool?>(json['serverStale']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'resourceKey': serializer.toJson<String>(resourceKey),
      'season': serializer.toJson<int?>(season),
      'entityId': serializer.toJson<String?>(entityId),
      'round': serializer.toJson<int?>(round),
      'etag': serializer.toJson<String?>(etag),
      'generatedAt': serializer.toJson<DateTime?>(generatedAt),
      'sourceUpdatedAt': serializer.toJson<DateTime?>(sourceUpdatedAt),
      'staleAfter': serializer.toJson<DateTime?>(staleAfter),
      'contentVersion': serializer.toJson<String?>(contentVersion),
      'lastAttemptAt': serializer.toJson<DateTime?>(lastAttemptAt),
      'lastSuccessAt': serializer.toJson<DateTime?>(lastSuccessAt),
      'lastFailureCategory': serializer.toJson<String?>(lastFailureCategory),
      'serverStale': serializer.toJson<bool?>(serverStale),
    };
  }

  ResourceSyncMetadataRow copyWith({
    String? resourceKey,
    Value<int?> season = const Value.absent(),
    Value<String?> entityId = const Value.absent(),
    Value<int?> round = const Value.absent(),
    Value<String?> etag = const Value.absent(),
    Value<DateTime?> generatedAt = const Value.absent(),
    Value<DateTime?> sourceUpdatedAt = const Value.absent(),
    Value<DateTime?> staleAfter = const Value.absent(),
    Value<String?> contentVersion = const Value.absent(),
    Value<DateTime?> lastAttemptAt = const Value.absent(),
    Value<DateTime?> lastSuccessAt = const Value.absent(),
    Value<String?> lastFailureCategory = const Value.absent(),
    Value<bool?> serverStale = const Value.absent(),
  }) => ResourceSyncMetadataRow(
    resourceKey: resourceKey ?? this.resourceKey,
    season: season.present ? season.value : this.season,
    entityId: entityId.present ? entityId.value : this.entityId,
    round: round.present ? round.value : this.round,
    etag: etag.present ? etag.value : this.etag,
    generatedAt: generatedAt.present ? generatedAt.value : this.generatedAt,
    sourceUpdatedAt: sourceUpdatedAt.present
        ? sourceUpdatedAt.value
        : this.sourceUpdatedAt,
    staleAfter: staleAfter.present ? staleAfter.value : this.staleAfter,
    contentVersion: contentVersion.present
        ? contentVersion.value
        : this.contentVersion,
    lastAttemptAt: lastAttemptAt.present
        ? lastAttemptAt.value
        : this.lastAttemptAt,
    lastSuccessAt: lastSuccessAt.present
        ? lastSuccessAt.value
        : this.lastSuccessAt,
    lastFailureCategory: lastFailureCategory.present
        ? lastFailureCategory.value
        : this.lastFailureCategory,
    serverStale: serverStale.present ? serverStale.value : this.serverStale,
  );
  ResourceSyncMetadataRow copyWithCompanion(
    ResourceSyncMetadataCompanion data,
  ) {
    return ResourceSyncMetadataRow(
      resourceKey: data.resourceKey.present
          ? data.resourceKey.value
          : this.resourceKey,
      season: data.season.present ? data.season.value : this.season,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      round: data.round.present ? data.round.value : this.round,
      etag: data.etag.present ? data.etag.value : this.etag,
      generatedAt: data.generatedAt.present
          ? data.generatedAt.value
          : this.generatedAt,
      sourceUpdatedAt: data.sourceUpdatedAt.present
          ? data.sourceUpdatedAt.value
          : this.sourceUpdatedAt,
      staleAfter: data.staleAfter.present
          ? data.staleAfter.value
          : this.staleAfter,
      contentVersion: data.contentVersion.present
          ? data.contentVersion.value
          : this.contentVersion,
      lastAttemptAt: data.lastAttemptAt.present
          ? data.lastAttemptAt.value
          : this.lastAttemptAt,
      lastSuccessAt: data.lastSuccessAt.present
          ? data.lastSuccessAt.value
          : this.lastSuccessAt,
      lastFailureCategory: data.lastFailureCategory.present
          ? data.lastFailureCategory.value
          : this.lastFailureCategory,
      serverStale: data.serverStale.present
          ? data.serverStale.value
          : this.serverStale,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ResourceSyncMetadataRow(')
          ..write('resourceKey: $resourceKey, ')
          ..write('season: $season, ')
          ..write('entityId: $entityId, ')
          ..write('round: $round, ')
          ..write('etag: $etag, ')
          ..write('generatedAt: $generatedAt, ')
          ..write('sourceUpdatedAt: $sourceUpdatedAt, ')
          ..write('staleAfter: $staleAfter, ')
          ..write('contentVersion: $contentVersion, ')
          ..write('lastAttemptAt: $lastAttemptAt, ')
          ..write('lastSuccessAt: $lastSuccessAt, ')
          ..write('lastFailureCategory: $lastFailureCategory, ')
          ..write('serverStale: $serverStale')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    resourceKey,
    season,
    entityId,
    round,
    etag,
    generatedAt,
    sourceUpdatedAt,
    staleAfter,
    contentVersion,
    lastAttemptAt,
    lastSuccessAt,
    lastFailureCategory,
    serverStale,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ResourceSyncMetadataRow &&
          other.resourceKey == this.resourceKey &&
          other.season == this.season &&
          other.entityId == this.entityId &&
          other.round == this.round &&
          other.etag == this.etag &&
          other.generatedAt == this.generatedAt &&
          other.sourceUpdatedAt == this.sourceUpdatedAt &&
          other.staleAfter == this.staleAfter &&
          other.contentVersion == this.contentVersion &&
          other.lastAttemptAt == this.lastAttemptAt &&
          other.lastSuccessAt == this.lastSuccessAt &&
          other.lastFailureCategory == this.lastFailureCategory &&
          other.serverStale == this.serverStale);
}

class ResourceSyncMetadataCompanion
    extends UpdateCompanion<ResourceSyncMetadataRow> {
  final Value<String> resourceKey;
  final Value<int?> season;
  final Value<String?> entityId;
  final Value<int?> round;
  final Value<String?> etag;
  final Value<DateTime?> generatedAt;
  final Value<DateTime?> sourceUpdatedAt;
  final Value<DateTime?> staleAfter;
  final Value<String?> contentVersion;
  final Value<DateTime?> lastAttemptAt;
  final Value<DateTime?> lastSuccessAt;
  final Value<String?> lastFailureCategory;
  final Value<bool?> serverStale;
  final Value<int> rowid;
  const ResourceSyncMetadataCompanion({
    this.resourceKey = const Value.absent(),
    this.season = const Value.absent(),
    this.entityId = const Value.absent(),
    this.round = const Value.absent(),
    this.etag = const Value.absent(),
    this.generatedAt = const Value.absent(),
    this.sourceUpdatedAt = const Value.absent(),
    this.staleAfter = const Value.absent(),
    this.contentVersion = const Value.absent(),
    this.lastAttemptAt = const Value.absent(),
    this.lastSuccessAt = const Value.absent(),
    this.lastFailureCategory = const Value.absent(),
    this.serverStale = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ResourceSyncMetadataCompanion.insert({
    required String resourceKey,
    this.season = const Value.absent(),
    this.entityId = const Value.absent(),
    this.round = const Value.absent(),
    this.etag = const Value.absent(),
    this.generatedAt = const Value.absent(),
    this.sourceUpdatedAt = const Value.absent(),
    this.staleAfter = const Value.absent(),
    this.contentVersion = const Value.absent(),
    this.lastAttemptAt = const Value.absent(),
    this.lastSuccessAt = const Value.absent(),
    this.lastFailureCategory = const Value.absent(),
    this.serverStale = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : resourceKey = Value(resourceKey);
  static Insertable<ResourceSyncMetadataRow> custom({
    Expression<String>? resourceKey,
    Expression<int>? season,
    Expression<String>? entityId,
    Expression<int>? round,
    Expression<String>? etag,
    Expression<DateTime>? generatedAt,
    Expression<DateTime>? sourceUpdatedAt,
    Expression<DateTime>? staleAfter,
    Expression<String>? contentVersion,
    Expression<DateTime>? lastAttemptAt,
    Expression<DateTime>? lastSuccessAt,
    Expression<String>? lastFailureCategory,
    Expression<bool>? serverStale,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (resourceKey != null) 'resource_key': resourceKey,
      if (season != null) 'season': season,
      if (entityId != null) 'entity_id': entityId,
      if (round != null) 'round': round,
      if (etag != null) 'etag': etag,
      if (generatedAt != null) 'generated_at': generatedAt,
      if (sourceUpdatedAt != null) 'source_updated_at': sourceUpdatedAt,
      if (staleAfter != null) 'stale_after': staleAfter,
      if (contentVersion != null) 'content_version': contentVersion,
      if (lastAttemptAt != null) 'last_attempt_at': lastAttemptAt,
      if (lastSuccessAt != null) 'last_success_at': lastSuccessAt,
      if (lastFailureCategory != null)
        'last_failure_category': lastFailureCategory,
      if (serverStale != null) 'server_stale': serverStale,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ResourceSyncMetadataCompanion copyWith({
    Value<String>? resourceKey,
    Value<int?>? season,
    Value<String?>? entityId,
    Value<int?>? round,
    Value<String?>? etag,
    Value<DateTime?>? generatedAt,
    Value<DateTime?>? sourceUpdatedAt,
    Value<DateTime?>? staleAfter,
    Value<String?>? contentVersion,
    Value<DateTime?>? lastAttemptAt,
    Value<DateTime?>? lastSuccessAt,
    Value<String?>? lastFailureCategory,
    Value<bool?>? serverStale,
    Value<int>? rowid,
  }) {
    return ResourceSyncMetadataCompanion(
      resourceKey: resourceKey ?? this.resourceKey,
      season: season ?? this.season,
      entityId: entityId ?? this.entityId,
      round: round ?? this.round,
      etag: etag ?? this.etag,
      generatedAt: generatedAt ?? this.generatedAt,
      sourceUpdatedAt: sourceUpdatedAt ?? this.sourceUpdatedAt,
      staleAfter: staleAfter ?? this.staleAfter,
      contentVersion: contentVersion ?? this.contentVersion,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      lastSuccessAt: lastSuccessAt ?? this.lastSuccessAt,
      lastFailureCategory: lastFailureCategory ?? this.lastFailureCategory,
      serverStale: serverStale ?? this.serverStale,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (resourceKey.present) {
      map['resource_key'] = Variable<String>(resourceKey.value);
    }
    if (season.present) {
      map['season'] = Variable<int>(season.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (round.present) {
      map['round'] = Variable<int>(round.value);
    }
    if (etag.present) {
      map['etag'] = Variable<String>(etag.value);
    }
    if (generatedAt.present) {
      map['generated_at'] = Variable<DateTime>(generatedAt.value);
    }
    if (sourceUpdatedAt.present) {
      map['source_updated_at'] = Variable<DateTime>(sourceUpdatedAt.value);
    }
    if (staleAfter.present) {
      map['stale_after'] = Variable<DateTime>(staleAfter.value);
    }
    if (contentVersion.present) {
      map['content_version'] = Variable<String>(contentVersion.value);
    }
    if (lastAttemptAt.present) {
      map['last_attempt_at'] = Variable<DateTime>(lastAttemptAt.value);
    }
    if (lastSuccessAt.present) {
      map['last_success_at'] = Variable<DateTime>(lastSuccessAt.value);
    }
    if (lastFailureCategory.present) {
      map['last_failure_category'] = Variable<String>(
        lastFailureCategory.value,
      );
    }
    if (serverStale.present) {
      map['server_stale'] = Variable<bool>(serverStale.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ResourceSyncMetadataCompanion(')
          ..write('resourceKey: $resourceKey, ')
          ..write('season: $season, ')
          ..write('entityId: $entityId, ')
          ..write('round: $round, ')
          ..write('etag: $etag, ')
          ..write('generatedAt: $generatedAt, ')
          ..write('sourceUpdatedAt: $sourceUpdatedAt, ')
          ..write('staleAfter: $staleAfter, ')
          ..write('contentVersion: $contentVersion, ')
          ..write('lastAttemptAt: $lastAttemptAt, ')
          ..write('lastSuccessAt: $lastSuccessAt, ')
          ..write('lastFailureCategory: $lastFailureCategory, ')
          ..write('serverStale: $serverStale, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$GridViewDatabase extends GeneratedDatabase {
  _$GridViewDatabase(QueryExecutor e) : super(e);
  $GridViewDatabaseManager get managers => $GridViewDatabaseManager(this);
  late final $SeasonsTable seasons = $SeasonsTable(this);
  late final $CircuitsTable circuits = $CircuitsTable(this);
  late final $GrandPrixEventsTable grandPrixEvents = $GrandPrixEventsTable(
    this,
  );
  late final $SessionsTable sessions = $SessionsTable(this);
  late final $SnapshotsTable snapshots = $SnapshotsTable(this);
  late final $DriversTable drivers = $DriversTable(this);
  late final $ConstructorsTable constructors = $ConstructorsTable(this);
  late final $DriverSeasonEntriesTable driverSeasonEntries =
      $DriverSeasonEntriesTable(this);
  late final $ConstructorSeasonEntriesTable constructorSeasonEntries =
      $ConstructorSeasonEntriesTable(this);
  late final $DriverStandingsTable driverStandings = $DriverStandingsTable(
    this,
  );
  late final $ConstructorStandingsTable constructorStandings =
      $ConstructorStandingsTable(this);
  late final $RaceResultsTable raceResults = $RaceResultsTable(this);
  late final $RaceResultEntriesTable raceResultEntries =
      $RaceResultEntriesTable(this);
  late final $MediaAssetsTable mediaAssets = $MediaAssetsTable(this);
  late final $MediaAssetVariantsTable mediaAssetVariants =
      $MediaAssetVariantsTable(this);
  late final $DriverMediaTable driverMedia = $DriverMediaTable(this);
  late final $ConstructorMediaTable constructorMedia = $ConstructorMediaTable(
    this,
  );
  late final $CircuitMediaTable circuitMedia = $CircuitMediaTable(this);
  late final $GrandPrixMediaTable grandPrixMedia = $GrandPrixMediaTable(this);
  late final $ResourceSyncMetadataTable resourceSyncMetadata =
      $ResourceSyncMetadataTable(this);
  late final Index idxGrandPrixSeasonStart = Index(
    'idx_grand_prix_season_start',
    'CREATE INDEX idx_grand_prix_season_start ON grand_prix (season, start_date)',
  );
  late final Index idxGrandPrixCircuitSeason = Index(
    'idx_grand_prix_circuit_season',
    'CREATE INDEX idx_grand_prix_circuit_season ON grand_prix (circuit_id, season)',
  );
  late final Index idxSessionsGpOrder = Index(
    'idx_sessions_gp_order',
    'CREATE INDEX idx_sessions_gp_order ON sessions (grand_prix_id, order_index)',
  );
  late final Index idxDseSeasonDriver = Index(
    'idx_dse_season_driver',
    'CREATE INDEX idx_dse_season_driver ON driver_season_entries (season, driver_id, start_round, end_round)',
  );
  late final Index idxDseSeasonConstructor = Index(
    'idx_dse_season_constructor',
    'CREATE INDEX idx_dse_season_constructor ON driver_season_entries (season, constructor_id, start_round, end_round)',
  );
  late final Index idxDriverStandingsSeasonOrder = Index(
    'idx_driver_standings_season_order',
    'CREATE INDEX idx_driver_standings_season_order ON driver_standings (season, order_index)',
  );
  late final Index idxConstructorStandingsSeasonOrder = Index(
    'idx_constructor_standings_season_order',
    'CREATE INDEX idx_constructor_standings_season_order ON constructor_standings (season, order_index)',
  );
  late final Index idxRreResultOrder = Index(
    'idx_rre_result_order',
    'CREATE INDEX idx_rre_result_order ON race_result_entries (race_result_id, order_index)',
  );
  late final Index idxDriverMediaDriver = Index(
    'idx_driver_media_driver',
    'CREATE INDEX idx_driver_media_driver ON driver_media (driver_id)',
  );
  late final Index idxConstructorMediaConstructor = Index(
    'idx_constructor_media_constructor',
    'CREATE INDEX idx_constructor_media_constructor ON constructor_media (constructor_id)',
  );
  late final Index idxCircuitMediaCircuit = Index(
    'idx_circuit_media_circuit',
    'CREATE INDEX idx_circuit_media_circuit ON circuit_media (circuit_id)',
  );
  late final Index idxGrandPrixMediaGp = Index(
    'idx_grand_prix_media_gp',
    'CREATE INDEX idx_grand_prix_media_gp ON grand_prix_media (grand_prix_id)',
  );
  late final Index idxResourceSyncStaleAfter = Index(
    'idx_resource_sync_stale_after',
    'CREATE INDEX idx_resource_sync_stale_after ON resource_sync_metadata (stale_after)',
  );
  late final Index idxResourceSyncSeasonStale = Index(
    'idx_resource_sync_season_stale',
    'CREATE INDEX idx_resource_sync_season_stale ON resource_sync_metadata (season, stale_after)',
  );
  late final VerticalSliceDao verticalSliceDao = VerticalSliceDao(
    this as GridViewDatabase,
  );
  late final MediaDao mediaDao = MediaDao(this as GridViewDatabase);
  late final StandingsDao standingsDao = StandingsDao(this as GridViewDatabase);
  late final ResultsDao resultsDao = ResultsDao(this as GridViewDatabase);
  late final CompetitorDao competitorDao = CompetitorDao(
    this as GridViewDatabase,
  );
  late final CalendarDao calendarDao = CalendarDao(this as GridViewDatabase);
  late final SyncMetadataDao syncMetadataDao = SyncMetadataDao(
    this as GridViewDatabase,
  );
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    seasons,
    circuits,
    grandPrixEvents,
    sessions,
    snapshots,
    drivers,
    constructors,
    driverSeasonEntries,
    constructorSeasonEntries,
    driverStandings,
    constructorStandings,
    raceResults,
    raceResultEntries,
    mediaAssets,
    mediaAssetVariants,
    driverMedia,
    constructorMedia,
    circuitMedia,
    grandPrixMedia,
    resourceSyncMetadata,
    idxGrandPrixSeasonStart,
    idxGrandPrixCircuitSeason,
    idxSessionsGpOrder,
    idxDseSeasonDriver,
    idxDseSeasonConstructor,
    idxDriverStandingsSeasonOrder,
    idxConstructorStandingsSeasonOrder,
    idxRreResultOrder,
    idxDriverMediaDriver,
    idxConstructorMediaConstructor,
    idxCircuitMediaCircuit,
    idxGrandPrixMediaGp,
    idxResourceSyncStaleAfter,
    idxResourceSyncSeasonStale,
  ];
  @override
  StreamQueryUpdateRules get streamUpdateRules => const StreamQueryUpdateRules([
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'grand_prix',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('sessions', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'grand_prix',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('race_results', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'race_results',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('race_result_entries', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'media_assets',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('media_variants', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'media_assets',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('driver_media', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'drivers',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('driver_media', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'media_assets',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('constructor_media', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'constructors',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('constructor_media', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'media_assets',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('circuit_media', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'circuits',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('circuit_media', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'media_assets',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('grand_prix_media', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'grand_prix',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('grand_prix_media', kind: UpdateKind.delete)],
    ),
  ]);
  @override
  DriftDatabaseOptions get options =>
      const DriftDatabaseOptions(storeDateTimeAsText: true);
}

typedef $$SeasonsTableCreateCompanionBuilder =
    SeasonsCompanion Function({
      Value<int> year,
      Value<String?> label,
      required String status,
      Value<String?> startDate,
      Value<String?> endDate,
      Value<int?> roundCount,
      Value<int?> currentRound,
      Value<bool> isCurrent,
    });
typedef $$SeasonsTableUpdateCompanionBuilder =
    SeasonsCompanion Function({
      Value<int> year,
      Value<String?> label,
      Value<String> status,
      Value<String?> startDate,
      Value<String?> endDate,
      Value<int?> roundCount,
      Value<int?> currentRound,
      Value<bool> isCurrent,
    });

final class $$SeasonsTableReferences
    extends BaseReferences<_$GridViewDatabase, $SeasonsTable, SeasonRow> {
  $$SeasonsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$GrandPrixEventsTable, List<GrandPrixRow>>
  _grandPrixEventsRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.grandPrixEvents,
        aliasName: 'seasons__year__grand_prix__season',
      );

  $$GrandPrixEventsTableProcessedTableManager get grandPrixEventsRefs {
    final manager = $$GrandPrixEventsTableTableManager(
      $_db,
      $_db.grandPrixEvents,
    ).filter((f) => f.season.year.sqlEquals($_itemColumn<int>('year')!));

    final cache = $_typedResult.readTableOrNull(
      _grandPrixEventsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<
    $DriverSeasonEntriesTable,
    List<DriverSeasonEntryRow>
  >
  _driverSeasonEntriesRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.driverSeasonEntries,
        aliasName: 'seasons__year__driver_season_entries__season',
      );

  $$DriverSeasonEntriesTableProcessedTableManager get driverSeasonEntriesRefs {
    final manager = $$DriverSeasonEntriesTableTableManager(
      $_db,
      $_db.driverSeasonEntries,
    ).filter((f) => f.season.year.sqlEquals($_itemColumn<int>('year')!));

    final cache = $_typedResult.readTableOrNull(
      _driverSeasonEntriesRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<
    $ConstructorSeasonEntriesTable,
    List<ConstructorSeasonEntryRow>
  >
  _constructorSeasonEntriesRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.constructorSeasonEntries,
        aliasName: 'seasons__year__constructor_season_entries__season',
      );

  $$ConstructorSeasonEntriesTableProcessedTableManager
  get constructorSeasonEntriesRefs {
    final manager = $$ConstructorSeasonEntriesTableTableManager(
      $_db,
      $_db.constructorSeasonEntries,
    ).filter((f) => f.season.year.sqlEquals($_itemColumn<int>('year')!));

    final cache = $_typedResult.readTableOrNull(
      _constructorSeasonEntriesRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$DriverStandingsTable, List<DriverStandingRow>>
  _driverStandingsRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.driverStandings,
        aliasName: 'seasons__year__driver_standings__season',
      );

  $$DriverStandingsTableProcessedTableManager get driverStandingsRefs {
    final manager = $$DriverStandingsTableTableManager(
      $_db,
      $_db.driverStandings,
    ).filter((f) => f.season.year.sqlEquals($_itemColumn<int>('year')!));

    final cache = $_typedResult.readTableOrNull(
      _driverStandingsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<
    $ConstructorStandingsTable,
    List<ConstructorStandingRow>
  >
  _constructorStandingsRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.constructorStandings,
        aliasName: 'seasons__year__constructor_standings__season',
      );

  $$ConstructorStandingsTableProcessedTableManager
  get constructorStandingsRefs {
    final manager = $$ConstructorStandingsTableTableManager(
      $_db,
      $_db.constructorStandings,
    ).filter((f) => f.season.year.sqlEquals($_itemColumn<int>('year')!));

    final cache = $_typedResult.readTableOrNull(
      _constructorStandingsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$SeasonsTableFilterComposer
    extends Composer<_$GridViewDatabase, $SeasonsTable> {
  $$SeasonsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get year => $composableBuilder(
    column: $table.year,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get label => $composableBuilder(
    column: $table.label,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get startDate => $composableBuilder(
    column: $table.startDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get endDate => $composableBuilder(
    column: $table.endDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get roundCount => $composableBuilder(
    column: $table.roundCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get currentRound => $composableBuilder(
    column: $table.currentRound,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isCurrent => $composableBuilder(
    column: $table.isCurrent,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> grandPrixEventsRefs(
    Expression<bool> Function($$GrandPrixEventsTableFilterComposer f) f,
  ) {
    final $$GrandPrixEventsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.year,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.season,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableFilterComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> driverSeasonEntriesRefs(
    Expression<bool> Function($$DriverSeasonEntriesTableFilterComposer f) f,
  ) {
    final $$DriverSeasonEntriesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.year,
      referencedTable: $db.driverSeasonEntries,
      getReferencedColumn: (t) => t.season,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverSeasonEntriesTableFilterComposer(
            $db: $db,
            $table: $db.driverSeasonEntries,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> constructorSeasonEntriesRefs(
    Expression<bool> Function($$ConstructorSeasonEntriesTableFilterComposer f)
    f,
  ) {
    final $$ConstructorSeasonEntriesTableFilterComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.year,
          referencedTable: $db.constructorSeasonEntries,
          getReferencedColumn: (t) => t.season,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$ConstructorSeasonEntriesTableFilterComposer(
                $db: $db,
                $table: $db.constructorSeasonEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<bool> driverStandingsRefs(
    Expression<bool> Function($$DriverStandingsTableFilterComposer f) f,
  ) {
    final $$DriverStandingsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.year,
      referencedTable: $db.driverStandings,
      getReferencedColumn: (t) => t.season,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverStandingsTableFilterComposer(
            $db: $db,
            $table: $db.driverStandings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> constructorStandingsRefs(
    Expression<bool> Function($$ConstructorStandingsTableFilterComposer f) f,
  ) {
    final $$ConstructorStandingsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.year,
      referencedTable: $db.constructorStandings,
      getReferencedColumn: (t) => t.season,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorStandingsTableFilterComposer(
            $db: $db,
            $table: $db.constructorStandings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$SeasonsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $SeasonsTable> {
  $$SeasonsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get year => $composableBuilder(
    column: $table.year,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get label => $composableBuilder(
    column: $table.label,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get startDate => $composableBuilder(
    column: $table.startDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get endDate => $composableBuilder(
    column: $table.endDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get roundCount => $composableBuilder(
    column: $table.roundCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get currentRound => $composableBuilder(
    column: $table.currentRound,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isCurrent => $composableBuilder(
    column: $table.isCurrent,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SeasonsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $SeasonsTable> {
  $$SeasonsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get year =>
      $composableBuilder(column: $table.year, builder: (column) => column);

  GeneratedColumn<String> get label =>
      $composableBuilder(column: $table.label, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => column);

  GeneratedColumn<String> get endDate =>
      $composableBuilder(column: $table.endDate, builder: (column) => column);

  GeneratedColumn<int> get roundCount => $composableBuilder(
    column: $table.roundCount,
    builder: (column) => column,
  );

  GeneratedColumn<int> get currentRound => $composableBuilder(
    column: $table.currentRound,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get isCurrent =>
      $composableBuilder(column: $table.isCurrent, builder: (column) => column);

  Expression<T> grandPrixEventsRefs<T extends Object>(
    Expression<T> Function($$GrandPrixEventsTableAnnotationComposer a) f,
  ) {
    final $$GrandPrixEventsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.year,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.season,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableAnnotationComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> driverSeasonEntriesRefs<T extends Object>(
    Expression<T> Function($$DriverSeasonEntriesTableAnnotationComposer a) f,
  ) {
    final $$DriverSeasonEntriesTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.year,
          referencedTable: $db.driverSeasonEntries,
          getReferencedColumn: (t) => t.season,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$DriverSeasonEntriesTableAnnotationComposer(
                $db: $db,
                $table: $db.driverSeasonEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> constructorSeasonEntriesRefs<T extends Object>(
    Expression<T> Function($$ConstructorSeasonEntriesTableAnnotationComposer a)
    f,
  ) {
    final $$ConstructorSeasonEntriesTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.year,
          referencedTable: $db.constructorSeasonEntries,
          getReferencedColumn: (t) => t.season,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$ConstructorSeasonEntriesTableAnnotationComposer(
                $db: $db,
                $table: $db.constructorSeasonEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> driverStandingsRefs<T extends Object>(
    Expression<T> Function($$DriverStandingsTableAnnotationComposer a) f,
  ) {
    final $$DriverStandingsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.year,
      referencedTable: $db.driverStandings,
      getReferencedColumn: (t) => t.season,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverStandingsTableAnnotationComposer(
            $db: $db,
            $table: $db.driverStandings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> constructorStandingsRefs<T extends Object>(
    Expression<T> Function($$ConstructorStandingsTableAnnotationComposer a) f,
  ) {
    final $$ConstructorStandingsTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.year,
          referencedTable: $db.constructorStandings,
          getReferencedColumn: (t) => t.season,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$ConstructorStandingsTableAnnotationComposer(
                $db: $db,
                $table: $db.constructorStandings,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }
}

class $$SeasonsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $SeasonsTable,
          SeasonRow,
          $$SeasonsTableFilterComposer,
          $$SeasonsTableOrderingComposer,
          $$SeasonsTableAnnotationComposer,
          $$SeasonsTableCreateCompanionBuilder,
          $$SeasonsTableUpdateCompanionBuilder,
          (SeasonRow, $$SeasonsTableReferences),
          SeasonRow,
          PrefetchHooks Function({
            bool grandPrixEventsRefs,
            bool driverSeasonEntriesRefs,
            bool constructorSeasonEntriesRefs,
            bool driverStandingsRefs,
            bool constructorStandingsRefs,
          })
        > {
  $$SeasonsTableTableManager(_$GridViewDatabase db, $SeasonsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SeasonsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SeasonsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SeasonsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> year = const Value.absent(),
                Value<String?> label = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String?> startDate = const Value.absent(),
                Value<String?> endDate = const Value.absent(),
                Value<int?> roundCount = const Value.absent(),
                Value<int?> currentRound = const Value.absent(),
                Value<bool> isCurrent = const Value.absent(),
              }) => SeasonsCompanion(
                year: year,
                label: label,
                status: status,
                startDate: startDate,
                endDate: endDate,
                roundCount: roundCount,
                currentRound: currentRound,
                isCurrent: isCurrent,
              ),
          createCompanionCallback:
              ({
                Value<int> year = const Value.absent(),
                Value<String?> label = const Value.absent(),
                required String status,
                Value<String?> startDate = const Value.absent(),
                Value<String?> endDate = const Value.absent(),
                Value<int?> roundCount = const Value.absent(),
                Value<int?> currentRound = const Value.absent(),
                Value<bool> isCurrent = const Value.absent(),
              }) => SeasonsCompanion.insert(
                year: year,
                label: label,
                status: status,
                startDate: startDate,
                endDate: endDate,
                roundCount: roundCount,
                currentRound: currentRound,
                isCurrent: isCurrent,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$SeasonsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({
                grandPrixEventsRefs = false,
                driverSeasonEntriesRefs = false,
                constructorSeasonEntriesRefs = false,
                driverStandingsRefs = false,
                constructorStandingsRefs = false,
              }) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (grandPrixEventsRefs) db.grandPrixEvents,
                    if (driverSeasonEntriesRefs) db.driverSeasonEntries,
                    if (constructorSeasonEntriesRefs)
                      db.constructorSeasonEntries,
                    if (driverStandingsRefs) db.driverStandings,
                    if (constructorStandingsRefs) db.constructorStandings,
                  ],
                  addJoins: null,
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (grandPrixEventsRefs)
                        await $_getPrefetchedData<
                          SeasonRow,
                          $SeasonsTable,
                          GrandPrixRow
                        >(
                          currentTable: table,
                          referencedTable: $$SeasonsTableReferences
                              ._grandPrixEventsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$SeasonsTableReferences(
                                db,
                                table,
                                p0,
                              ).grandPrixEventsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.season == item.year,
                              ),
                          typedResults: items,
                        ),
                      if (driverSeasonEntriesRefs)
                        await $_getPrefetchedData<
                          SeasonRow,
                          $SeasonsTable,
                          DriverSeasonEntryRow
                        >(
                          currentTable: table,
                          referencedTable: $$SeasonsTableReferences
                              ._driverSeasonEntriesRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$SeasonsTableReferences(
                                db,
                                table,
                                p0,
                              ).driverSeasonEntriesRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.season == item.year,
                              ),
                          typedResults: items,
                        ),
                      if (constructorSeasonEntriesRefs)
                        await $_getPrefetchedData<
                          SeasonRow,
                          $SeasonsTable,
                          ConstructorSeasonEntryRow
                        >(
                          currentTable: table,
                          referencedTable: $$SeasonsTableReferences
                              ._constructorSeasonEntriesRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$SeasonsTableReferences(
                                db,
                                table,
                                p0,
                              ).constructorSeasonEntriesRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.season == item.year,
                              ),
                          typedResults: items,
                        ),
                      if (driverStandingsRefs)
                        await $_getPrefetchedData<
                          SeasonRow,
                          $SeasonsTable,
                          DriverStandingRow
                        >(
                          currentTable: table,
                          referencedTable: $$SeasonsTableReferences
                              ._driverStandingsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$SeasonsTableReferences(
                                db,
                                table,
                                p0,
                              ).driverStandingsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.season == item.year,
                              ),
                          typedResults: items,
                        ),
                      if (constructorStandingsRefs)
                        await $_getPrefetchedData<
                          SeasonRow,
                          $SeasonsTable,
                          ConstructorStandingRow
                        >(
                          currentTable: table,
                          referencedTable: $$SeasonsTableReferences
                              ._constructorStandingsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$SeasonsTableReferences(
                                db,
                                table,
                                p0,
                              ).constructorStandingsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.season == item.year,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$SeasonsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $SeasonsTable,
      SeasonRow,
      $$SeasonsTableFilterComposer,
      $$SeasonsTableOrderingComposer,
      $$SeasonsTableAnnotationComposer,
      $$SeasonsTableCreateCompanionBuilder,
      $$SeasonsTableUpdateCompanionBuilder,
      (SeasonRow, $$SeasonsTableReferences),
      SeasonRow,
      PrefetchHooks Function({
        bool grandPrixEventsRefs,
        bool driverSeasonEntriesRefs,
        bool constructorSeasonEntriesRefs,
        bool driverStandingsRefs,
        bool constructorStandingsRefs,
      })
    >;
typedef $$CircuitsTableCreateCompanionBuilder =
    CircuitsCompanion Function({
      required String id,
      required String name,
      Value<String?> locality,
      Value<String?> country,
      Value<String?> countryCode,
      Value<double?> latitude,
      Value<double?> longitude,
      Value<int?> lengthMeters,
      Value<int?> cornerCount,
      Value<String?> direction,
      Value<int?> firstGrandPrixYear,
      Value<String?> lapRecordDriverId,
      Value<int?> lapRecordTimeMillis,
      Value<int?> lapRecordYear,
      Value<int> rowid,
    });
typedef $$CircuitsTableUpdateCompanionBuilder =
    CircuitsCompanion Function({
      Value<String> id,
      Value<String> name,
      Value<String?> locality,
      Value<String?> country,
      Value<String?> countryCode,
      Value<double?> latitude,
      Value<double?> longitude,
      Value<int?> lengthMeters,
      Value<int?> cornerCount,
      Value<String?> direction,
      Value<int?> firstGrandPrixYear,
      Value<String?> lapRecordDriverId,
      Value<int?> lapRecordTimeMillis,
      Value<int?> lapRecordYear,
      Value<int> rowid,
    });

final class $$CircuitsTableReferences
    extends BaseReferences<_$GridViewDatabase, $CircuitsTable, CircuitRow> {
  $$CircuitsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$GrandPrixEventsTable, List<GrandPrixRow>>
  _grandPrixEventsRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.grandPrixEvents,
        aliasName: 'circuits__id__grand_prix__circuit_id',
      );

  $$GrandPrixEventsTableProcessedTableManager get grandPrixEventsRefs {
    final manager = $$GrandPrixEventsTableTableManager(
      $_db,
      $_db.grandPrixEvents,
    ).filter((f) => f.circuitId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _grandPrixEventsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$CircuitMediaTable, List<CircuitMediaRow>>
  _circuitMediaRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.circuitMedia,
        aliasName: 'circuits__id__circuit_media__circuit_id',
      );

  $$CircuitMediaTableProcessedTableManager get circuitMediaRefs {
    final manager = $$CircuitMediaTableTableManager(
      $_db,
      $_db.circuitMedia,
    ).filter((f) => f.circuitId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_circuitMediaRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$CircuitsTableFilterComposer
    extends Composer<_$GridViewDatabase, $CircuitsTable> {
  $$CircuitsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get locality => $composableBuilder(
    column: $table.locality,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get country => $composableBuilder(
    column: $table.country,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get latitude => $composableBuilder(
    column: $table.latitude,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get longitude => $composableBuilder(
    column: $table.longitude,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lengthMeters => $composableBuilder(
    column: $table.lengthMeters,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get cornerCount => $composableBuilder(
    column: $table.cornerCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get direction => $composableBuilder(
    column: $table.direction,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get firstGrandPrixYear => $composableBuilder(
    column: $table.firstGrandPrixYear,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lapRecordDriverId => $composableBuilder(
    column: $table.lapRecordDriverId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lapRecordTimeMillis => $composableBuilder(
    column: $table.lapRecordTimeMillis,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lapRecordYear => $composableBuilder(
    column: $table.lapRecordYear,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> grandPrixEventsRefs(
    Expression<bool> Function($$GrandPrixEventsTableFilterComposer f) f,
  ) {
    final $$GrandPrixEventsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.circuitId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableFilterComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> circuitMediaRefs(
    Expression<bool> Function($$CircuitMediaTableFilterComposer f) f,
  ) {
    final $$CircuitMediaTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.circuitMedia,
      getReferencedColumn: (t) => t.circuitId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitMediaTableFilterComposer(
            $db: $db,
            $table: $db.circuitMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$CircuitsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $CircuitsTable> {
  $$CircuitsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get locality => $composableBuilder(
    column: $table.locality,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get country => $composableBuilder(
    column: $table.country,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get latitude => $composableBuilder(
    column: $table.latitude,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get longitude => $composableBuilder(
    column: $table.longitude,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lengthMeters => $composableBuilder(
    column: $table.lengthMeters,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get cornerCount => $composableBuilder(
    column: $table.cornerCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get direction => $composableBuilder(
    column: $table.direction,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get firstGrandPrixYear => $composableBuilder(
    column: $table.firstGrandPrixYear,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lapRecordDriverId => $composableBuilder(
    column: $table.lapRecordDriverId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lapRecordTimeMillis => $composableBuilder(
    column: $table.lapRecordTimeMillis,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lapRecordYear => $composableBuilder(
    column: $table.lapRecordYear,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CircuitsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $CircuitsTable> {
  $$CircuitsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get locality =>
      $composableBuilder(column: $table.locality, builder: (column) => column);

  GeneratedColumn<String> get country =>
      $composableBuilder(column: $table.country, builder: (column) => column);

  GeneratedColumn<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => column,
  );

  GeneratedColumn<double> get latitude =>
      $composableBuilder(column: $table.latitude, builder: (column) => column);

  GeneratedColumn<double> get longitude =>
      $composableBuilder(column: $table.longitude, builder: (column) => column);

  GeneratedColumn<int> get lengthMeters => $composableBuilder(
    column: $table.lengthMeters,
    builder: (column) => column,
  );

  GeneratedColumn<int> get cornerCount => $composableBuilder(
    column: $table.cornerCount,
    builder: (column) => column,
  );

  GeneratedColumn<String> get direction =>
      $composableBuilder(column: $table.direction, builder: (column) => column);

  GeneratedColumn<int> get firstGrandPrixYear => $composableBuilder(
    column: $table.firstGrandPrixYear,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lapRecordDriverId => $composableBuilder(
    column: $table.lapRecordDriverId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get lapRecordTimeMillis => $composableBuilder(
    column: $table.lapRecordTimeMillis,
    builder: (column) => column,
  );

  GeneratedColumn<int> get lapRecordYear => $composableBuilder(
    column: $table.lapRecordYear,
    builder: (column) => column,
  );

  Expression<T> grandPrixEventsRefs<T extends Object>(
    Expression<T> Function($$GrandPrixEventsTableAnnotationComposer a) f,
  ) {
    final $$GrandPrixEventsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.circuitId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableAnnotationComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> circuitMediaRefs<T extends Object>(
    Expression<T> Function($$CircuitMediaTableAnnotationComposer a) f,
  ) {
    final $$CircuitMediaTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.circuitMedia,
      getReferencedColumn: (t) => t.circuitId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitMediaTableAnnotationComposer(
            $db: $db,
            $table: $db.circuitMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$CircuitsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $CircuitsTable,
          CircuitRow,
          $$CircuitsTableFilterComposer,
          $$CircuitsTableOrderingComposer,
          $$CircuitsTableAnnotationComposer,
          $$CircuitsTableCreateCompanionBuilder,
          $$CircuitsTableUpdateCompanionBuilder,
          (CircuitRow, $$CircuitsTableReferences),
          CircuitRow,
          PrefetchHooks Function({
            bool grandPrixEventsRefs,
            bool circuitMediaRefs,
          })
        > {
  $$CircuitsTableTableManager(_$GridViewDatabase db, $CircuitsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CircuitsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CircuitsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CircuitsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> locality = const Value.absent(),
                Value<String?> country = const Value.absent(),
                Value<String?> countryCode = const Value.absent(),
                Value<double?> latitude = const Value.absent(),
                Value<double?> longitude = const Value.absent(),
                Value<int?> lengthMeters = const Value.absent(),
                Value<int?> cornerCount = const Value.absent(),
                Value<String?> direction = const Value.absent(),
                Value<int?> firstGrandPrixYear = const Value.absent(),
                Value<String?> lapRecordDriverId = const Value.absent(),
                Value<int?> lapRecordTimeMillis = const Value.absent(),
                Value<int?> lapRecordYear = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CircuitsCompanion(
                id: id,
                name: name,
                locality: locality,
                country: country,
                countryCode: countryCode,
                latitude: latitude,
                longitude: longitude,
                lengthMeters: lengthMeters,
                cornerCount: cornerCount,
                direction: direction,
                firstGrandPrixYear: firstGrandPrixYear,
                lapRecordDriverId: lapRecordDriverId,
                lapRecordTimeMillis: lapRecordTimeMillis,
                lapRecordYear: lapRecordYear,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String name,
                Value<String?> locality = const Value.absent(),
                Value<String?> country = const Value.absent(),
                Value<String?> countryCode = const Value.absent(),
                Value<double?> latitude = const Value.absent(),
                Value<double?> longitude = const Value.absent(),
                Value<int?> lengthMeters = const Value.absent(),
                Value<int?> cornerCount = const Value.absent(),
                Value<String?> direction = const Value.absent(),
                Value<int?> firstGrandPrixYear = const Value.absent(),
                Value<String?> lapRecordDriverId = const Value.absent(),
                Value<int?> lapRecordTimeMillis = const Value.absent(),
                Value<int?> lapRecordYear = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CircuitsCompanion.insert(
                id: id,
                name: name,
                locality: locality,
                country: country,
                countryCode: countryCode,
                latitude: latitude,
                longitude: longitude,
                lengthMeters: lengthMeters,
                cornerCount: cornerCount,
                direction: direction,
                firstGrandPrixYear: firstGrandPrixYear,
                lapRecordDriverId: lapRecordDriverId,
                lapRecordTimeMillis: lapRecordTimeMillis,
                lapRecordYear: lapRecordYear,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$CircuitsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({grandPrixEventsRefs = false, circuitMediaRefs = false}) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (grandPrixEventsRefs) db.grandPrixEvents,
                    if (circuitMediaRefs) db.circuitMedia,
                  ],
                  addJoins: null,
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (grandPrixEventsRefs)
                        await $_getPrefetchedData<
                          CircuitRow,
                          $CircuitsTable,
                          GrandPrixRow
                        >(
                          currentTable: table,
                          referencedTable: $$CircuitsTableReferences
                              ._grandPrixEventsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$CircuitsTableReferences(
                                db,
                                table,
                                p0,
                              ).grandPrixEventsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.circuitId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (circuitMediaRefs)
                        await $_getPrefetchedData<
                          CircuitRow,
                          $CircuitsTable,
                          CircuitMediaRow
                        >(
                          currentTable: table,
                          referencedTable: $$CircuitsTableReferences
                              ._circuitMediaRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$CircuitsTableReferences(
                                db,
                                table,
                                p0,
                              ).circuitMediaRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.circuitId == item.id,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$CircuitsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $CircuitsTable,
      CircuitRow,
      $$CircuitsTableFilterComposer,
      $$CircuitsTableOrderingComposer,
      $$CircuitsTableAnnotationComposer,
      $$CircuitsTableCreateCompanionBuilder,
      $$CircuitsTableUpdateCompanionBuilder,
      (CircuitRow, $$CircuitsTableReferences),
      CircuitRow,
      PrefetchHooks Function({bool grandPrixEventsRefs, bool circuitMediaRefs})
    >;
typedef $$GrandPrixEventsTableCreateCompanionBuilder =
    GrandPrixEventsCompanion Function({
      required String id,
      required int season,
      required int round,
      required String eventSlug,
      required String name,
      Value<String?> officialName,
      required String circuitId,
      required String status,
      required String format,
      Value<String?> startDate,
      Value<String?> endDate,
      Value<String?> timezone,
      Value<bool> hasResults,
      Value<int> rowid,
    });
typedef $$GrandPrixEventsTableUpdateCompanionBuilder =
    GrandPrixEventsCompanion Function({
      Value<String> id,
      Value<int> season,
      Value<int> round,
      Value<String> eventSlug,
      Value<String> name,
      Value<String?> officialName,
      Value<String> circuitId,
      Value<String> status,
      Value<String> format,
      Value<String?> startDate,
      Value<String?> endDate,
      Value<String?> timezone,
      Value<bool> hasResults,
      Value<int> rowid,
    });

final class $$GrandPrixEventsTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $GrandPrixEventsTable,
          GrandPrixRow
        > {
  $$GrandPrixEventsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $SeasonsTable _seasonTable(_$GridViewDatabase db) =>
      db.seasons.createAlias('grand_prix__season__seasons__year');

  $$SeasonsTableProcessedTableManager get season {
    final $_column = $_itemColumn<int>('season')!;

    final manager = $$SeasonsTableTableManager(
      $_db,
      $_db.seasons,
    ).filter((f) => f.year.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_seasonTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $CircuitsTable _circuitIdTable(_$GridViewDatabase db) =>
      db.circuits.createAlias('grand_prix__circuit_id__circuits__id');

  $$CircuitsTableProcessedTableManager get circuitId {
    final $_column = $_itemColumn<String>('circuit_id')!;

    final manager = $$CircuitsTableTableManager(
      $_db,
      $_db.circuits,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_circuitIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static MultiTypedResultKey<$SessionsTable, List<SessionRow>>
  _sessionsRefsTable(_$GridViewDatabase db) => MultiTypedResultKey.fromTable(
    db.sessions,
    aliasName: 'grand_prix__id__sessions__grand_prix_id',
  );

  $$SessionsTableProcessedTableManager get sessionsRefs {
    final manager = $$SessionsTableTableManager(
      $_db,
      $_db.sessions,
    ).filter((f) => f.grandPrixId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_sessionsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$RaceResultsTable, List<RaceResultRow>>
  _raceResultsRefsTable(_$GridViewDatabase db) => MultiTypedResultKey.fromTable(
    db.raceResults,
    aliasName: 'grand_prix__id__race_results__grand_prix_id',
  );

  $$RaceResultsTableProcessedTableManager get raceResultsRefs {
    final manager = $$RaceResultsTableTableManager(
      $_db,
      $_db.raceResults,
    ).filter((f) => f.grandPrixId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_raceResultsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$GrandPrixMediaTable, List<GrandPrixMediaRow>>
  _grandPrixMediaRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.grandPrixMedia,
        aliasName: 'grand_prix__id__grand_prix_media__grand_prix_id',
      );

  $$GrandPrixMediaTableProcessedTableManager get grandPrixMediaRefs {
    final manager = $$GrandPrixMediaTableTableManager(
      $_db,
      $_db.grandPrixMedia,
    ).filter((f) => f.grandPrixId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_grandPrixMediaRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$GrandPrixEventsTableFilterComposer
    extends Composer<_$GridViewDatabase, $GrandPrixEventsTable> {
  $$GrandPrixEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get round => $composableBuilder(
    column: $table.round,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get eventSlug => $composableBuilder(
    column: $table.eventSlug,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get officialName => $composableBuilder(
    column: $table.officialName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get format => $composableBuilder(
    column: $table.format,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get startDate => $composableBuilder(
    column: $table.startDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get endDate => $composableBuilder(
    column: $table.endDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get timezone => $composableBuilder(
    column: $table.timezone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get hasResults => $composableBuilder(
    column: $table.hasResults,
    builder: (column) => ColumnFilters(column),
  );

  $$SeasonsTableFilterComposer get season {
    final $$SeasonsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableFilterComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$CircuitsTableFilterComposer get circuitId {
    final $$CircuitsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.circuitId,
      referencedTable: $db.circuits,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitsTableFilterComposer(
            $db: $db,
            $table: $db.circuits,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  Expression<bool> sessionsRefs(
    Expression<bool> Function($$SessionsTableFilterComposer f) f,
  ) {
    final $$SessionsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.sessions,
      getReferencedColumn: (t) => t.grandPrixId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SessionsTableFilterComposer(
            $db: $db,
            $table: $db.sessions,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> raceResultsRefs(
    Expression<bool> Function($$RaceResultsTableFilterComposer f) f,
  ) {
    final $$RaceResultsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.raceResults,
      getReferencedColumn: (t) => t.grandPrixId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RaceResultsTableFilterComposer(
            $db: $db,
            $table: $db.raceResults,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> grandPrixMediaRefs(
    Expression<bool> Function($$GrandPrixMediaTableFilterComposer f) f,
  ) {
    final $$GrandPrixMediaTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.grandPrixMedia,
      getReferencedColumn: (t) => t.grandPrixId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixMediaTableFilterComposer(
            $db: $db,
            $table: $db.grandPrixMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$GrandPrixEventsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $GrandPrixEventsTable> {
  $$GrandPrixEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get round => $composableBuilder(
    column: $table.round,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get eventSlug => $composableBuilder(
    column: $table.eventSlug,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get officialName => $composableBuilder(
    column: $table.officialName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get format => $composableBuilder(
    column: $table.format,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get startDate => $composableBuilder(
    column: $table.startDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get endDate => $composableBuilder(
    column: $table.endDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get timezone => $composableBuilder(
    column: $table.timezone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get hasResults => $composableBuilder(
    column: $table.hasResults,
    builder: (column) => ColumnOrderings(column),
  );

  $$SeasonsTableOrderingComposer get season {
    final $$SeasonsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableOrderingComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$CircuitsTableOrderingComposer get circuitId {
    final $$CircuitsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.circuitId,
      referencedTable: $db.circuits,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitsTableOrderingComposer(
            $db: $db,
            $table: $db.circuits,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$GrandPrixEventsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $GrandPrixEventsTable> {
  $$GrandPrixEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get round =>
      $composableBuilder(column: $table.round, builder: (column) => column);

  GeneratedColumn<String> get eventSlug =>
      $composableBuilder(column: $table.eventSlug, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get officialName => $composableBuilder(
    column: $table.officialName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get format =>
      $composableBuilder(column: $table.format, builder: (column) => column);

  GeneratedColumn<String> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => column);

  GeneratedColumn<String> get endDate =>
      $composableBuilder(column: $table.endDate, builder: (column) => column);

  GeneratedColumn<String> get timezone =>
      $composableBuilder(column: $table.timezone, builder: (column) => column);

  GeneratedColumn<bool> get hasResults => $composableBuilder(
    column: $table.hasResults,
    builder: (column) => column,
  );

  $$SeasonsTableAnnotationComposer get season {
    final $$SeasonsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableAnnotationComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$CircuitsTableAnnotationComposer get circuitId {
    final $$CircuitsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.circuitId,
      referencedTable: $db.circuits,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitsTableAnnotationComposer(
            $db: $db,
            $table: $db.circuits,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  Expression<T> sessionsRefs<T extends Object>(
    Expression<T> Function($$SessionsTableAnnotationComposer a) f,
  ) {
    final $$SessionsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.sessions,
      getReferencedColumn: (t) => t.grandPrixId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SessionsTableAnnotationComposer(
            $db: $db,
            $table: $db.sessions,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> raceResultsRefs<T extends Object>(
    Expression<T> Function($$RaceResultsTableAnnotationComposer a) f,
  ) {
    final $$RaceResultsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.raceResults,
      getReferencedColumn: (t) => t.grandPrixId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RaceResultsTableAnnotationComposer(
            $db: $db,
            $table: $db.raceResults,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> grandPrixMediaRefs<T extends Object>(
    Expression<T> Function($$GrandPrixMediaTableAnnotationComposer a) f,
  ) {
    final $$GrandPrixMediaTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.grandPrixMedia,
      getReferencedColumn: (t) => t.grandPrixId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixMediaTableAnnotationComposer(
            $db: $db,
            $table: $db.grandPrixMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$GrandPrixEventsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $GrandPrixEventsTable,
          GrandPrixRow,
          $$GrandPrixEventsTableFilterComposer,
          $$GrandPrixEventsTableOrderingComposer,
          $$GrandPrixEventsTableAnnotationComposer,
          $$GrandPrixEventsTableCreateCompanionBuilder,
          $$GrandPrixEventsTableUpdateCompanionBuilder,
          (GrandPrixRow, $$GrandPrixEventsTableReferences),
          GrandPrixRow,
          PrefetchHooks Function({
            bool season,
            bool circuitId,
            bool sessionsRefs,
            bool raceResultsRefs,
            bool grandPrixMediaRefs,
          })
        > {
  $$GrandPrixEventsTableTableManager(
    _$GridViewDatabase db,
    $GrandPrixEventsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$GrandPrixEventsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$GrandPrixEventsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$GrandPrixEventsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<int> season = const Value.absent(),
                Value<int> round = const Value.absent(),
                Value<String> eventSlug = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> officialName = const Value.absent(),
                Value<String> circuitId = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String> format = const Value.absent(),
                Value<String?> startDate = const Value.absent(),
                Value<String?> endDate = const Value.absent(),
                Value<String?> timezone = const Value.absent(),
                Value<bool> hasResults = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => GrandPrixEventsCompanion(
                id: id,
                season: season,
                round: round,
                eventSlug: eventSlug,
                name: name,
                officialName: officialName,
                circuitId: circuitId,
                status: status,
                format: format,
                startDate: startDate,
                endDate: endDate,
                timezone: timezone,
                hasResults: hasResults,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required int season,
                required int round,
                required String eventSlug,
                required String name,
                Value<String?> officialName = const Value.absent(),
                required String circuitId,
                required String status,
                required String format,
                Value<String?> startDate = const Value.absent(),
                Value<String?> endDate = const Value.absent(),
                Value<String?> timezone = const Value.absent(),
                Value<bool> hasResults = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => GrandPrixEventsCompanion.insert(
                id: id,
                season: season,
                round: round,
                eventSlug: eventSlug,
                name: name,
                officialName: officialName,
                circuitId: circuitId,
                status: status,
                format: format,
                startDate: startDate,
                endDate: endDate,
                timezone: timezone,
                hasResults: hasResults,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$GrandPrixEventsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({
                season = false,
                circuitId = false,
                sessionsRefs = false,
                raceResultsRefs = false,
                grandPrixMediaRefs = false,
              }) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (sessionsRefs) db.sessions,
                    if (raceResultsRefs) db.raceResults,
                    if (grandPrixMediaRefs) db.grandPrixMedia,
                  ],
                  addJoins:
                      <
                        T extends TableManagerState<
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic
                        >
                      >(state) {
                        if (season) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.season,
                                    referencedTable:
                                        $$GrandPrixEventsTableReferences
                                            ._seasonTable(db),
                                    referencedColumn:
                                        $$GrandPrixEventsTableReferences
                                            ._seasonTable(db)
                                            .year,
                                  )
                                  as T;
                        }
                        if (circuitId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.circuitId,
                                    referencedTable:
                                        $$GrandPrixEventsTableReferences
                                            ._circuitIdTable(db),
                                    referencedColumn:
                                        $$GrandPrixEventsTableReferences
                                            ._circuitIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }

                        return state;
                      },
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (sessionsRefs)
                        await $_getPrefetchedData<
                          GrandPrixRow,
                          $GrandPrixEventsTable,
                          SessionRow
                        >(
                          currentTable: table,
                          referencedTable: $$GrandPrixEventsTableReferences
                              ._sessionsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$GrandPrixEventsTableReferences(
                                db,
                                table,
                                p0,
                              ).sessionsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.grandPrixId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (raceResultsRefs)
                        await $_getPrefetchedData<
                          GrandPrixRow,
                          $GrandPrixEventsTable,
                          RaceResultRow
                        >(
                          currentTable: table,
                          referencedTable: $$GrandPrixEventsTableReferences
                              ._raceResultsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$GrandPrixEventsTableReferences(
                                db,
                                table,
                                p0,
                              ).raceResultsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.grandPrixId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (grandPrixMediaRefs)
                        await $_getPrefetchedData<
                          GrandPrixRow,
                          $GrandPrixEventsTable,
                          GrandPrixMediaRow
                        >(
                          currentTable: table,
                          referencedTable: $$GrandPrixEventsTableReferences
                              ._grandPrixMediaRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$GrandPrixEventsTableReferences(
                                db,
                                table,
                                p0,
                              ).grandPrixMediaRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.grandPrixId == item.id,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$GrandPrixEventsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $GrandPrixEventsTable,
      GrandPrixRow,
      $$GrandPrixEventsTableFilterComposer,
      $$GrandPrixEventsTableOrderingComposer,
      $$GrandPrixEventsTableAnnotationComposer,
      $$GrandPrixEventsTableCreateCompanionBuilder,
      $$GrandPrixEventsTableUpdateCompanionBuilder,
      (GrandPrixRow, $$GrandPrixEventsTableReferences),
      GrandPrixRow,
      PrefetchHooks Function({
        bool season,
        bool circuitId,
        bool sessionsRefs,
        bool raceResultsRefs,
        bool grandPrixMediaRefs,
      })
    >;
typedef $$SessionsTableCreateCompanionBuilder =
    SessionsCompanion Function({
      required String id,
      required String grandPrixId,
      required String type,
      Value<String?> name,
      Value<DateTime?> startTimeUtc,
      Value<DateTime?> endTimeUtc,
      required String status,
      required int orderIndex,
      Value<int> rowid,
    });
typedef $$SessionsTableUpdateCompanionBuilder =
    SessionsCompanion Function({
      Value<String> id,
      Value<String> grandPrixId,
      Value<String> type,
      Value<String?> name,
      Value<DateTime?> startTimeUtc,
      Value<DateTime?> endTimeUtc,
      Value<String> status,
      Value<int> orderIndex,
      Value<int> rowid,
    });

final class $$SessionsTableReferences
    extends BaseReferences<_$GridViewDatabase, $SessionsTable, SessionRow> {
  $$SessionsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $GrandPrixEventsTable _grandPrixIdTable(_$GridViewDatabase db) =>
      db.grandPrixEvents.createAlias('sessions__grand_prix_id__grand_prix__id');

  $$GrandPrixEventsTableProcessedTableManager get grandPrixId {
    final $_column = $_itemColumn<String>('grand_prix_id')!;

    final manager = $$GrandPrixEventsTableTableManager(
      $_db,
      $_db.grandPrixEvents,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_grandPrixIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$SessionsTableFilterComposer
    extends Composer<_$GridViewDatabase, $SessionsTable> {
  $$SessionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get startTimeUtc => $composableBuilder(
    column: $table.startTimeUtc,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get endTimeUtc => $composableBuilder(
    column: $table.endTimeUtc,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnFilters(column),
  );

  $$GrandPrixEventsTableFilterComposer get grandPrixId {
    final $$GrandPrixEventsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableFilterComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SessionsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $SessionsTable> {
  $$SessionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get startTimeUtc => $composableBuilder(
    column: $table.startTimeUtc,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get endTimeUtc => $composableBuilder(
    column: $table.endTimeUtc,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnOrderings(column),
  );

  $$GrandPrixEventsTableOrderingComposer get grandPrixId {
    final $$GrandPrixEventsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableOrderingComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SessionsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $SessionsTable> {
  $$SessionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<DateTime> get startTimeUtc => $composableBuilder(
    column: $table.startTimeUtc,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get endTimeUtc => $composableBuilder(
    column: $table.endTimeUtc,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => column,
  );

  $$GrandPrixEventsTableAnnotationComposer get grandPrixId {
    final $$GrandPrixEventsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableAnnotationComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SessionsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $SessionsTable,
          SessionRow,
          $$SessionsTableFilterComposer,
          $$SessionsTableOrderingComposer,
          $$SessionsTableAnnotationComposer,
          $$SessionsTableCreateCompanionBuilder,
          $$SessionsTableUpdateCompanionBuilder,
          (SessionRow, $$SessionsTableReferences),
          SessionRow,
          PrefetchHooks Function({bool grandPrixId})
        > {
  $$SessionsTableTableManager(_$GridViewDatabase db, $SessionsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SessionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SessionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SessionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> grandPrixId = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String?> name = const Value.absent(),
                Value<DateTime?> startTimeUtc = const Value.absent(),
                Value<DateTime?> endTimeUtc = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> orderIndex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SessionsCompanion(
                id: id,
                grandPrixId: grandPrixId,
                type: type,
                name: name,
                startTimeUtc: startTimeUtc,
                endTimeUtc: endTimeUtc,
                status: status,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String grandPrixId,
                required String type,
                Value<String?> name = const Value.absent(),
                Value<DateTime?> startTimeUtc = const Value.absent(),
                Value<DateTime?> endTimeUtc = const Value.absent(),
                required String status,
                required int orderIndex,
                Value<int> rowid = const Value.absent(),
              }) => SessionsCompanion.insert(
                id: id,
                grandPrixId: grandPrixId,
                type: type,
                name: name,
                startTimeUtc: startTimeUtc,
                endTimeUtc: endTimeUtc,
                status: status,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$SessionsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({grandPrixId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (grandPrixId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.grandPrixId,
                                referencedTable: $$SessionsTableReferences
                                    ._grandPrixIdTable(db),
                                referencedColumn: $$SessionsTableReferences
                                    ._grandPrixIdTable(db)
                                    .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$SessionsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $SessionsTable,
      SessionRow,
      $$SessionsTableFilterComposer,
      $$SessionsTableOrderingComposer,
      $$SessionsTableAnnotationComposer,
      $$SessionsTableCreateCompanionBuilder,
      $$SessionsTableUpdateCompanionBuilder,
      (SessionRow, $$SessionsTableReferences),
      SessionRow,
      PrefetchHooks Function({bool grandPrixId})
    >;
typedef $$SnapshotsTableCreateCompanionBuilder =
    SnapshotsCompanion Function({
      required String key,
      required DateTime generatedAt,
      Value<DateTime?> sourceUpdatedAt,
      Value<DateTime?> staleAfter,
      Value<String?> contentVersion,
      Value<bool?> serverStale,
      Value<int?> focusSeason,
      Value<int?> focusRound,
      Value<int> rowid,
    });
typedef $$SnapshotsTableUpdateCompanionBuilder =
    SnapshotsCompanion Function({
      Value<String> key,
      Value<DateTime> generatedAt,
      Value<DateTime?> sourceUpdatedAt,
      Value<DateTime?> staleAfter,
      Value<String?> contentVersion,
      Value<bool?> serverStale,
      Value<int?> focusSeason,
      Value<int?> focusRound,
      Value<int> rowid,
    });

class $$SnapshotsTableFilterComposer
    extends Composer<_$GridViewDatabase, $SnapshotsTable> {
  $$SnapshotsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get generatedAt => $composableBuilder(
    column: $table.generatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get sourceUpdatedAt => $composableBuilder(
    column: $table.sourceUpdatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get staleAfter => $composableBuilder(
    column: $table.staleAfter,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get contentVersion => $composableBuilder(
    column: $table.contentVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get serverStale => $composableBuilder(
    column: $table.serverStale,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get focusSeason => $composableBuilder(
    column: $table.focusSeason,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get focusRound => $composableBuilder(
    column: $table.focusRound,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SnapshotsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $SnapshotsTable> {
  $$SnapshotsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get generatedAt => $composableBuilder(
    column: $table.generatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get sourceUpdatedAt => $composableBuilder(
    column: $table.sourceUpdatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get staleAfter => $composableBuilder(
    column: $table.staleAfter,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get contentVersion => $composableBuilder(
    column: $table.contentVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get serverStale => $composableBuilder(
    column: $table.serverStale,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get focusSeason => $composableBuilder(
    column: $table.focusSeason,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get focusRound => $composableBuilder(
    column: $table.focusRound,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SnapshotsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $SnapshotsTable> {
  $$SnapshotsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<DateTime> get generatedAt => $composableBuilder(
    column: $table.generatedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get sourceUpdatedAt => $composableBuilder(
    column: $table.sourceUpdatedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get staleAfter => $composableBuilder(
    column: $table.staleAfter,
    builder: (column) => column,
  );

  GeneratedColumn<String> get contentVersion => $composableBuilder(
    column: $table.contentVersion,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get serverStale => $composableBuilder(
    column: $table.serverStale,
    builder: (column) => column,
  );

  GeneratedColumn<int> get focusSeason => $composableBuilder(
    column: $table.focusSeason,
    builder: (column) => column,
  );

  GeneratedColumn<int> get focusRound => $composableBuilder(
    column: $table.focusRound,
    builder: (column) => column,
  );
}

class $$SnapshotsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $SnapshotsTable,
          SnapshotRow,
          $$SnapshotsTableFilterComposer,
          $$SnapshotsTableOrderingComposer,
          $$SnapshotsTableAnnotationComposer,
          $$SnapshotsTableCreateCompanionBuilder,
          $$SnapshotsTableUpdateCompanionBuilder,
          (
            SnapshotRow,
            BaseReferences<_$GridViewDatabase, $SnapshotsTable, SnapshotRow>,
          ),
          SnapshotRow,
          PrefetchHooks Function()
        > {
  $$SnapshotsTableTableManager(_$GridViewDatabase db, $SnapshotsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SnapshotsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SnapshotsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SnapshotsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<DateTime> generatedAt = const Value.absent(),
                Value<DateTime?> sourceUpdatedAt = const Value.absent(),
                Value<DateTime?> staleAfter = const Value.absent(),
                Value<String?> contentVersion = const Value.absent(),
                Value<bool?> serverStale = const Value.absent(),
                Value<int?> focusSeason = const Value.absent(),
                Value<int?> focusRound = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SnapshotsCompanion(
                key: key,
                generatedAt: generatedAt,
                sourceUpdatedAt: sourceUpdatedAt,
                staleAfter: staleAfter,
                contentVersion: contentVersion,
                serverStale: serverStale,
                focusSeason: focusSeason,
                focusRound: focusRound,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String key,
                required DateTime generatedAt,
                Value<DateTime?> sourceUpdatedAt = const Value.absent(),
                Value<DateTime?> staleAfter = const Value.absent(),
                Value<String?> contentVersion = const Value.absent(),
                Value<bool?> serverStale = const Value.absent(),
                Value<int?> focusSeason = const Value.absent(),
                Value<int?> focusRound = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SnapshotsCompanion.insert(
                key: key,
                generatedAt: generatedAt,
                sourceUpdatedAt: sourceUpdatedAt,
                staleAfter: staleAfter,
                contentVersion: contentVersion,
                serverStale: serverStale,
                focusSeason: focusSeason,
                focusRound: focusRound,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SnapshotsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $SnapshotsTable,
      SnapshotRow,
      $$SnapshotsTableFilterComposer,
      $$SnapshotsTableOrderingComposer,
      $$SnapshotsTableAnnotationComposer,
      $$SnapshotsTableCreateCompanionBuilder,
      $$SnapshotsTableUpdateCompanionBuilder,
      (
        SnapshotRow,
        BaseReferences<_$GridViewDatabase, $SnapshotsTable, SnapshotRow>,
      ),
      SnapshotRow,
      PrefetchHooks Function()
    >;
typedef $$DriversTableCreateCompanionBuilder =
    DriversCompanion Function({
      required String id,
      required String fullName,
      Value<String?> givenName,
      Value<String?> familyName,
      Value<String?> shortCode,
      Value<int?> permanentNumber,
      Value<String?> nationality,
      Value<String?> countryCode,
      Value<String?> dateOfBirth,
      Value<String?> placeOfBirth,
      Value<String?> biography,
      Value<int> rowid,
    });
typedef $$DriversTableUpdateCompanionBuilder =
    DriversCompanion Function({
      Value<String> id,
      Value<String> fullName,
      Value<String?> givenName,
      Value<String?> familyName,
      Value<String?> shortCode,
      Value<int?> permanentNumber,
      Value<String?> nationality,
      Value<String?> countryCode,
      Value<String?> dateOfBirth,
      Value<String?> placeOfBirth,
      Value<String?> biography,
      Value<int> rowid,
    });

final class $$DriversTableReferences
    extends BaseReferences<_$GridViewDatabase, $DriversTable, DriverRow> {
  $$DriversTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<
    $DriverSeasonEntriesTable,
    List<DriverSeasonEntryRow>
  >
  _driverSeasonEntriesRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.driverSeasonEntries,
        aliasName: 'drivers__id__driver_season_entries__driver_id',
      );

  $$DriverSeasonEntriesTableProcessedTableManager get driverSeasonEntriesRefs {
    final manager = $$DriverSeasonEntriesTableTableManager(
      $_db,
      $_db.driverSeasonEntries,
    ).filter((f) => f.driverId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _driverSeasonEntriesRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$DriverStandingsTable, List<DriverStandingRow>>
  _driverStandingsRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.driverStandings,
        aliasName: 'drivers__id__driver_standings__driver_id',
      );

  $$DriverStandingsTableProcessedTableManager get driverStandingsRefs {
    final manager = $$DriverStandingsTableTableManager(
      $_db,
      $_db.driverStandings,
    ).filter((f) => f.driverId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _driverStandingsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$RaceResultEntriesTable, List<RaceResultEntryRow>>
  _raceResultEntriesRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.raceResultEntries,
        aliasName: 'drivers__id__race_result_entries__driver_id',
      );

  $$RaceResultEntriesTableProcessedTableManager get raceResultEntriesRefs {
    final manager = $$RaceResultEntriesTableTableManager(
      $_db,
      $_db.raceResultEntries,
    ).filter((f) => f.driverId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _raceResultEntriesRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$DriverMediaTable, List<DriverMediaRow>>
  _driverMediaRefsTable(_$GridViewDatabase db) => MultiTypedResultKey.fromTable(
    db.driverMedia,
    aliasName: 'drivers__id__driver_media__driver_id',
  );

  $$DriverMediaTableProcessedTableManager get driverMediaRefs {
    final manager = $$DriverMediaTableTableManager(
      $_db,
      $_db.driverMedia,
    ).filter((f) => f.driverId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_driverMediaRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$DriversTableFilterComposer
    extends Composer<_$GridViewDatabase, $DriversTable> {
  $$DriversTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fullName => $composableBuilder(
    column: $table.fullName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get givenName => $composableBuilder(
    column: $table.givenName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get familyName => $composableBuilder(
    column: $table.familyName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get shortCode => $composableBuilder(
    column: $table.shortCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get permanentNumber => $composableBuilder(
    column: $table.permanentNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get nationality => $composableBuilder(
    column: $table.nationality,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dateOfBirth => $composableBuilder(
    column: $table.dateOfBirth,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get placeOfBirth => $composableBuilder(
    column: $table.placeOfBirth,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get biography => $composableBuilder(
    column: $table.biography,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> driverSeasonEntriesRefs(
    Expression<bool> Function($$DriverSeasonEntriesTableFilterComposer f) f,
  ) {
    final $$DriverSeasonEntriesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverSeasonEntries,
      getReferencedColumn: (t) => t.driverId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverSeasonEntriesTableFilterComposer(
            $db: $db,
            $table: $db.driverSeasonEntries,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> driverStandingsRefs(
    Expression<bool> Function($$DriverStandingsTableFilterComposer f) f,
  ) {
    final $$DriverStandingsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverStandings,
      getReferencedColumn: (t) => t.driverId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverStandingsTableFilterComposer(
            $db: $db,
            $table: $db.driverStandings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> raceResultEntriesRefs(
    Expression<bool> Function($$RaceResultEntriesTableFilterComposer f) f,
  ) {
    final $$RaceResultEntriesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.raceResultEntries,
      getReferencedColumn: (t) => t.driverId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RaceResultEntriesTableFilterComposer(
            $db: $db,
            $table: $db.raceResultEntries,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> driverMediaRefs(
    Expression<bool> Function($$DriverMediaTableFilterComposer f) f,
  ) {
    final $$DriverMediaTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverMedia,
      getReferencedColumn: (t) => t.driverId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverMediaTableFilterComposer(
            $db: $db,
            $table: $db.driverMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$DriversTableOrderingComposer
    extends Composer<_$GridViewDatabase, $DriversTable> {
  $$DriversTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fullName => $composableBuilder(
    column: $table.fullName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get givenName => $composableBuilder(
    column: $table.givenName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get familyName => $composableBuilder(
    column: $table.familyName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get shortCode => $composableBuilder(
    column: $table.shortCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get permanentNumber => $composableBuilder(
    column: $table.permanentNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get nationality => $composableBuilder(
    column: $table.nationality,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dateOfBirth => $composableBuilder(
    column: $table.dateOfBirth,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get placeOfBirth => $composableBuilder(
    column: $table.placeOfBirth,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get biography => $composableBuilder(
    column: $table.biography,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DriversTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $DriversTable> {
  $$DriversTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get fullName =>
      $composableBuilder(column: $table.fullName, builder: (column) => column);

  GeneratedColumn<String> get givenName =>
      $composableBuilder(column: $table.givenName, builder: (column) => column);

  GeneratedColumn<String> get familyName => $composableBuilder(
    column: $table.familyName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get shortCode =>
      $composableBuilder(column: $table.shortCode, builder: (column) => column);

  GeneratedColumn<int> get permanentNumber => $composableBuilder(
    column: $table.permanentNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get nationality => $composableBuilder(
    column: $table.nationality,
    builder: (column) => column,
  );

  GeneratedColumn<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => column,
  );

  GeneratedColumn<String> get dateOfBirth => $composableBuilder(
    column: $table.dateOfBirth,
    builder: (column) => column,
  );

  GeneratedColumn<String> get placeOfBirth => $composableBuilder(
    column: $table.placeOfBirth,
    builder: (column) => column,
  );

  GeneratedColumn<String> get biography =>
      $composableBuilder(column: $table.biography, builder: (column) => column);

  Expression<T> driverSeasonEntriesRefs<T extends Object>(
    Expression<T> Function($$DriverSeasonEntriesTableAnnotationComposer a) f,
  ) {
    final $$DriverSeasonEntriesTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.driverSeasonEntries,
          getReferencedColumn: (t) => t.driverId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$DriverSeasonEntriesTableAnnotationComposer(
                $db: $db,
                $table: $db.driverSeasonEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> driverStandingsRefs<T extends Object>(
    Expression<T> Function($$DriverStandingsTableAnnotationComposer a) f,
  ) {
    final $$DriverStandingsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverStandings,
      getReferencedColumn: (t) => t.driverId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverStandingsTableAnnotationComposer(
            $db: $db,
            $table: $db.driverStandings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> raceResultEntriesRefs<T extends Object>(
    Expression<T> Function($$RaceResultEntriesTableAnnotationComposer a) f,
  ) {
    final $$RaceResultEntriesTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.raceResultEntries,
          getReferencedColumn: (t) => t.driverId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$RaceResultEntriesTableAnnotationComposer(
                $db: $db,
                $table: $db.raceResultEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> driverMediaRefs<T extends Object>(
    Expression<T> Function($$DriverMediaTableAnnotationComposer a) f,
  ) {
    final $$DriverMediaTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverMedia,
      getReferencedColumn: (t) => t.driverId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverMediaTableAnnotationComposer(
            $db: $db,
            $table: $db.driverMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$DriversTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $DriversTable,
          DriverRow,
          $$DriversTableFilterComposer,
          $$DriversTableOrderingComposer,
          $$DriversTableAnnotationComposer,
          $$DriversTableCreateCompanionBuilder,
          $$DriversTableUpdateCompanionBuilder,
          (DriverRow, $$DriversTableReferences),
          DriverRow,
          PrefetchHooks Function({
            bool driverSeasonEntriesRefs,
            bool driverStandingsRefs,
            bool raceResultEntriesRefs,
            bool driverMediaRefs,
          })
        > {
  $$DriversTableTableManager(_$GridViewDatabase db, $DriversTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DriversTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DriversTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DriversTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> fullName = const Value.absent(),
                Value<String?> givenName = const Value.absent(),
                Value<String?> familyName = const Value.absent(),
                Value<String?> shortCode = const Value.absent(),
                Value<int?> permanentNumber = const Value.absent(),
                Value<String?> nationality = const Value.absent(),
                Value<String?> countryCode = const Value.absent(),
                Value<String?> dateOfBirth = const Value.absent(),
                Value<String?> placeOfBirth = const Value.absent(),
                Value<String?> biography = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DriversCompanion(
                id: id,
                fullName: fullName,
                givenName: givenName,
                familyName: familyName,
                shortCode: shortCode,
                permanentNumber: permanentNumber,
                nationality: nationality,
                countryCode: countryCode,
                dateOfBirth: dateOfBirth,
                placeOfBirth: placeOfBirth,
                biography: biography,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String fullName,
                Value<String?> givenName = const Value.absent(),
                Value<String?> familyName = const Value.absent(),
                Value<String?> shortCode = const Value.absent(),
                Value<int?> permanentNumber = const Value.absent(),
                Value<String?> nationality = const Value.absent(),
                Value<String?> countryCode = const Value.absent(),
                Value<String?> dateOfBirth = const Value.absent(),
                Value<String?> placeOfBirth = const Value.absent(),
                Value<String?> biography = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DriversCompanion.insert(
                id: id,
                fullName: fullName,
                givenName: givenName,
                familyName: familyName,
                shortCode: shortCode,
                permanentNumber: permanentNumber,
                nationality: nationality,
                countryCode: countryCode,
                dateOfBirth: dateOfBirth,
                placeOfBirth: placeOfBirth,
                biography: biography,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$DriversTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({
                driverSeasonEntriesRefs = false,
                driverStandingsRefs = false,
                raceResultEntriesRefs = false,
                driverMediaRefs = false,
              }) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (driverSeasonEntriesRefs) db.driverSeasonEntries,
                    if (driverStandingsRefs) db.driverStandings,
                    if (raceResultEntriesRefs) db.raceResultEntries,
                    if (driverMediaRefs) db.driverMedia,
                  ],
                  addJoins: null,
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (driverSeasonEntriesRefs)
                        await $_getPrefetchedData<
                          DriverRow,
                          $DriversTable,
                          DriverSeasonEntryRow
                        >(
                          currentTable: table,
                          referencedTable: $$DriversTableReferences
                              ._driverSeasonEntriesRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$DriversTableReferences(
                                db,
                                table,
                                p0,
                              ).driverSeasonEntriesRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.driverId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (driverStandingsRefs)
                        await $_getPrefetchedData<
                          DriverRow,
                          $DriversTable,
                          DriverStandingRow
                        >(
                          currentTable: table,
                          referencedTable: $$DriversTableReferences
                              ._driverStandingsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$DriversTableReferences(
                                db,
                                table,
                                p0,
                              ).driverStandingsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.driverId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (raceResultEntriesRefs)
                        await $_getPrefetchedData<
                          DriverRow,
                          $DriversTable,
                          RaceResultEntryRow
                        >(
                          currentTable: table,
                          referencedTable: $$DriversTableReferences
                              ._raceResultEntriesRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$DriversTableReferences(
                                db,
                                table,
                                p0,
                              ).raceResultEntriesRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.driverId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (driverMediaRefs)
                        await $_getPrefetchedData<
                          DriverRow,
                          $DriversTable,
                          DriverMediaRow
                        >(
                          currentTable: table,
                          referencedTable: $$DriversTableReferences
                              ._driverMediaRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$DriversTableReferences(
                                db,
                                table,
                                p0,
                              ).driverMediaRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.driverId == item.id,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$DriversTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $DriversTable,
      DriverRow,
      $$DriversTableFilterComposer,
      $$DriversTableOrderingComposer,
      $$DriversTableAnnotationComposer,
      $$DriversTableCreateCompanionBuilder,
      $$DriversTableUpdateCompanionBuilder,
      (DriverRow, $$DriversTableReferences),
      DriverRow,
      PrefetchHooks Function({
        bool driverSeasonEntriesRefs,
        bool driverStandingsRefs,
        bool raceResultEntriesRefs,
        bool driverMediaRefs,
      })
    >;
typedef $$ConstructorsTableCreateCompanionBuilder =
    ConstructorsCompanion Function({
      required String id,
      required String name,
      Value<String?> shortName,
      Value<String?> nationality,
      Value<String?> countryCode,
      Value<String?> colorPrimary,
      Value<String?> biography,
      Value<int> rowid,
    });
typedef $$ConstructorsTableUpdateCompanionBuilder =
    ConstructorsCompanion Function({
      Value<String> id,
      Value<String> name,
      Value<String?> shortName,
      Value<String?> nationality,
      Value<String?> countryCode,
      Value<String?> colorPrimary,
      Value<String?> biography,
      Value<int> rowid,
    });

final class $$ConstructorsTableReferences
    extends
        BaseReferences<_$GridViewDatabase, $ConstructorsTable, ConstructorRow> {
  $$ConstructorsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<
    $DriverSeasonEntriesTable,
    List<DriverSeasonEntryRow>
  >
  _driverSeasonEntriesRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.driverSeasonEntries,
        aliasName: 'constructors__id__driver_season_entries__constructor_id',
      );

  $$DriverSeasonEntriesTableProcessedTableManager get driverSeasonEntriesRefs {
    final manager = $$DriverSeasonEntriesTableTableManager(
      $_db,
      $_db.driverSeasonEntries,
    ).filter((f) => f.constructorId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _driverSeasonEntriesRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<
    $ConstructorSeasonEntriesTable,
    List<ConstructorSeasonEntryRow>
  >
  _constructorSeasonEntriesRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.constructorSeasonEntries,
        aliasName:
            'constructors__id__constructor_season_entries__constructor_id',
      );

  $$ConstructorSeasonEntriesTableProcessedTableManager
  get constructorSeasonEntriesRefs {
    final manager = $$ConstructorSeasonEntriesTableTableManager(
      $_db,
      $_db.constructorSeasonEntries,
    ).filter((f) => f.constructorId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _constructorSeasonEntriesRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$DriverStandingsTable, List<DriverStandingRow>>
  _driverStandingsRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.driverStandings,
        aliasName: 'constructors__id__driver_standings__constructor_id',
      );

  $$DriverStandingsTableProcessedTableManager get driverStandingsRefs {
    final manager = $$DriverStandingsTableTableManager(
      $_db,
      $_db.driverStandings,
    ).filter((f) => f.constructorId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _driverStandingsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<
    $ConstructorStandingsTable,
    List<ConstructorStandingRow>
  >
  _constructorStandingsRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.constructorStandings,
        aliasName: 'constructors__id__constructor_standings__constructor_id',
      );

  $$ConstructorStandingsTableProcessedTableManager
  get constructorStandingsRefs {
    final manager = $$ConstructorStandingsTableTableManager(
      $_db,
      $_db.constructorStandings,
    ).filter((f) => f.constructorId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _constructorStandingsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$RaceResultEntriesTable, List<RaceResultEntryRow>>
  _raceResultEntriesRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.raceResultEntries,
        aliasName: 'constructors__id__race_result_entries__constructor_id',
      );

  $$RaceResultEntriesTableProcessedTableManager get raceResultEntriesRefs {
    final manager = $$RaceResultEntriesTableTableManager(
      $_db,
      $_db.raceResultEntries,
    ).filter((f) => f.constructorId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _raceResultEntriesRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$ConstructorMediaTable, List<ConstructorMediaRow>>
  _constructorMediaRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.constructorMedia,
        aliasName: 'constructors__id__constructor_media__constructor_id',
      );

  $$ConstructorMediaTableProcessedTableManager get constructorMediaRefs {
    final manager = $$ConstructorMediaTableTableManager(
      $_db,
      $_db.constructorMedia,
    ).filter((f) => f.constructorId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _constructorMediaRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$ConstructorsTableFilterComposer
    extends Composer<_$GridViewDatabase, $ConstructorsTable> {
  $$ConstructorsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get shortName => $composableBuilder(
    column: $table.shortName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get nationality => $composableBuilder(
    column: $table.nationality,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get colorPrimary => $composableBuilder(
    column: $table.colorPrimary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get biography => $composableBuilder(
    column: $table.biography,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> driverSeasonEntriesRefs(
    Expression<bool> Function($$DriverSeasonEntriesTableFilterComposer f) f,
  ) {
    final $$DriverSeasonEntriesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverSeasonEntries,
      getReferencedColumn: (t) => t.constructorId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverSeasonEntriesTableFilterComposer(
            $db: $db,
            $table: $db.driverSeasonEntries,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> constructorSeasonEntriesRefs(
    Expression<bool> Function($$ConstructorSeasonEntriesTableFilterComposer f)
    f,
  ) {
    final $$ConstructorSeasonEntriesTableFilterComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.constructorSeasonEntries,
          getReferencedColumn: (t) => t.constructorId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$ConstructorSeasonEntriesTableFilterComposer(
                $db: $db,
                $table: $db.constructorSeasonEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<bool> driverStandingsRefs(
    Expression<bool> Function($$DriverStandingsTableFilterComposer f) f,
  ) {
    final $$DriverStandingsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverStandings,
      getReferencedColumn: (t) => t.constructorId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverStandingsTableFilterComposer(
            $db: $db,
            $table: $db.driverStandings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> constructorStandingsRefs(
    Expression<bool> Function($$ConstructorStandingsTableFilterComposer f) f,
  ) {
    final $$ConstructorStandingsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.constructorStandings,
      getReferencedColumn: (t) => t.constructorId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorStandingsTableFilterComposer(
            $db: $db,
            $table: $db.constructorStandings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> raceResultEntriesRefs(
    Expression<bool> Function($$RaceResultEntriesTableFilterComposer f) f,
  ) {
    final $$RaceResultEntriesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.raceResultEntries,
      getReferencedColumn: (t) => t.constructorId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RaceResultEntriesTableFilterComposer(
            $db: $db,
            $table: $db.raceResultEntries,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> constructorMediaRefs(
    Expression<bool> Function($$ConstructorMediaTableFilterComposer f) f,
  ) {
    final $$ConstructorMediaTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.constructorMedia,
      getReferencedColumn: (t) => t.constructorId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorMediaTableFilterComposer(
            $db: $db,
            $table: $db.constructorMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$ConstructorsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $ConstructorsTable> {
  $$ConstructorsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get shortName => $composableBuilder(
    column: $table.shortName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get nationality => $composableBuilder(
    column: $table.nationality,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get colorPrimary => $composableBuilder(
    column: $table.colorPrimary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get biography => $composableBuilder(
    column: $table.biography,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ConstructorsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $ConstructorsTable> {
  $$ConstructorsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get shortName =>
      $composableBuilder(column: $table.shortName, builder: (column) => column);

  GeneratedColumn<String> get nationality => $composableBuilder(
    column: $table.nationality,
    builder: (column) => column,
  );

  GeneratedColumn<String> get countryCode => $composableBuilder(
    column: $table.countryCode,
    builder: (column) => column,
  );

  GeneratedColumn<String> get colorPrimary => $composableBuilder(
    column: $table.colorPrimary,
    builder: (column) => column,
  );

  GeneratedColumn<String> get biography =>
      $composableBuilder(column: $table.biography, builder: (column) => column);

  Expression<T> driverSeasonEntriesRefs<T extends Object>(
    Expression<T> Function($$DriverSeasonEntriesTableAnnotationComposer a) f,
  ) {
    final $$DriverSeasonEntriesTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.driverSeasonEntries,
          getReferencedColumn: (t) => t.constructorId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$DriverSeasonEntriesTableAnnotationComposer(
                $db: $db,
                $table: $db.driverSeasonEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> constructorSeasonEntriesRefs<T extends Object>(
    Expression<T> Function($$ConstructorSeasonEntriesTableAnnotationComposer a)
    f,
  ) {
    final $$ConstructorSeasonEntriesTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.constructorSeasonEntries,
          getReferencedColumn: (t) => t.constructorId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$ConstructorSeasonEntriesTableAnnotationComposer(
                $db: $db,
                $table: $db.constructorSeasonEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> driverStandingsRefs<T extends Object>(
    Expression<T> Function($$DriverStandingsTableAnnotationComposer a) f,
  ) {
    final $$DriverStandingsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverStandings,
      getReferencedColumn: (t) => t.constructorId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverStandingsTableAnnotationComposer(
            $db: $db,
            $table: $db.driverStandings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> constructorStandingsRefs<T extends Object>(
    Expression<T> Function($$ConstructorStandingsTableAnnotationComposer a) f,
  ) {
    final $$ConstructorStandingsTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.constructorStandings,
          getReferencedColumn: (t) => t.constructorId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$ConstructorStandingsTableAnnotationComposer(
                $db: $db,
                $table: $db.constructorStandings,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> raceResultEntriesRefs<T extends Object>(
    Expression<T> Function($$RaceResultEntriesTableAnnotationComposer a) f,
  ) {
    final $$RaceResultEntriesTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.raceResultEntries,
          getReferencedColumn: (t) => t.constructorId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$RaceResultEntriesTableAnnotationComposer(
                $db: $db,
                $table: $db.raceResultEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> constructorMediaRefs<T extends Object>(
    Expression<T> Function($$ConstructorMediaTableAnnotationComposer a) f,
  ) {
    final $$ConstructorMediaTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.constructorMedia,
      getReferencedColumn: (t) => t.constructorId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorMediaTableAnnotationComposer(
            $db: $db,
            $table: $db.constructorMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$ConstructorsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $ConstructorsTable,
          ConstructorRow,
          $$ConstructorsTableFilterComposer,
          $$ConstructorsTableOrderingComposer,
          $$ConstructorsTableAnnotationComposer,
          $$ConstructorsTableCreateCompanionBuilder,
          $$ConstructorsTableUpdateCompanionBuilder,
          (ConstructorRow, $$ConstructorsTableReferences),
          ConstructorRow,
          PrefetchHooks Function({
            bool driverSeasonEntriesRefs,
            bool constructorSeasonEntriesRefs,
            bool driverStandingsRefs,
            bool constructorStandingsRefs,
            bool raceResultEntriesRefs,
            bool constructorMediaRefs,
          })
        > {
  $$ConstructorsTableTableManager(
    _$GridViewDatabase db,
    $ConstructorsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ConstructorsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ConstructorsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ConstructorsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> shortName = const Value.absent(),
                Value<String?> nationality = const Value.absent(),
                Value<String?> countryCode = const Value.absent(),
                Value<String?> colorPrimary = const Value.absent(),
                Value<String?> biography = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ConstructorsCompanion(
                id: id,
                name: name,
                shortName: shortName,
                nationality: nationality,
                countryCode: countryCode,
                colorPrimary: colorPrimary,
                biography: biography,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String name,
                Value<String?> shortName = const Value.absent(),
                Value<String?> nationality = const Value.absent(),
                Value<String?> countryCode = const Value.absent(),
                Value<String?> colorPrimary = const Value.absent(),
                Value<String?> biography = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ConstructorsCompanion.insert(
                id: id,
                name: name,
                shortName: shortName,
                nationality: nationality,
                countryCode: countryCode,
                colorPrimary: colorPrimary,
                biography: biography,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$ConstructorsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({
                driverSeasonEntriesRefs = false,
                constructorSeasonEntriesRefs = false,
                driverStandingsRefs = false,
                constructorStandingsRefs = false,
                raceResultEntriesRefs = false,
                constructorMediaRefs = false,
              }) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (driverSeasonEntriesRefs) db.driverSeasonEntries,
                    if (constructorSeasonEntriesRefs)
                      db.constructorSeasonEntries,
                    if (driverStandingsRefs) db.driverStandings,
                    if (constructorStandingsRefs) db.constructorStandings,
                    if (raceResultEntriesRefs) db.raceResultEntries,
                    if (constructorMediaRefs) db.constructorMedia,
                  ],
                  addJoins: null,
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (driverSeasonEntriesRefs)
                        await $_getPrefetchedData<
                          ConstructorRow,
                          $ConstructorsTable,
                          DriverSeasonEntryRow
                        >(
                          currentTable: table,
                          referencedTable: $$ConstructorsTableReferences
                              ._driverSeasonEntriesRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$ConstructorsTableReferences(
                                db,
                                table,
                                p0,
                              ).driverSeasonEntriesRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.constructorId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (constructorSeasonEntriesRefs)
                        await $_getPrefetchedData<
                          ConstructorRow,
                          $ConstructorsTable,
                          ConstructorSeasonEntryRow
                        >(
                          currentTable: table,
                          referencedTable: $$ConstructorsTableReferences
                              ._constructorSeasonEntriesRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$ConstructorsTableReferences(
                                db,
                                table,
                                p0,
                              ).constructorSeasonEntriesRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.constructorId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (driverStandingsRefs)
                        await $_getPrefetchedData<
                          ConstructorRow,
                          $ConstructorsTable,
                          DriverStandingRow
                        >(
                          currentTable: table,
                          referencedTable: $$ConstructorsTableReferences
                              ._driverStandingsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$ConstructorsTableReferences(
                                db,
                                table,
                                p0,
                              ).driverStandingsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.constructorId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (constructorStandingsRefs)
                        await $_getPrefetchedData<
                          ConstructorRow,
                          $ConstructorsTable,
                          ConstructorStandingRow
                        >(
                          currentTable: table,
                          referencedTable: $$ConstructorsTableReferences
                              ._constructorStandingsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$ConstructorsTableReferences(
                                db,
                                table,
                                p0,
                              ).constructorStandingsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.constructorId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (raceResultEntriesRefs)
                        await $_getPrefetchedData<
                          ConstructorRow,
                          $ConstructorsTable,
                          RaceResultEntryRow
                        >(
                          currentTable: table,
                          referencedTable: $$ConstructorsTableReferences
                              ._raceResultEntriesRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$ConstructorsTableReferences(
                                db,
                                table,
                                p0,
                              ).raceResultEntriesRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.constructorId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (constructorMediaRefs)
                        await $_getPrefetchedData<
                          ConstructorRow,
                          $ConstructorsTable,
                          ConstructorMediaRow
                        >(
                          currentTable: table,
                          referencedTable: $$ConstructorsTableReferences
                              ._constructorMediaRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$ConstructorsTableReferences(
                                db,
                                table,
                                p0,
                              ).constructorMediaRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.constructorId == item.id,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$ConstructorsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $ConstructorsTable,
      ConstructorRow,
      $$ConstructorsTableFilterComposer,
      $$ConstructorsTableOrderingComposer,
      $$ConstructorsTableAnnotationComposer,
      $$ConstructorsTableCreateCompanionBuilder,
      $$ConstructorsTableUpdateCompanionBuilder,
      (ConstructorRow, $$ConstructorsTableReferences),
      ConstructorRow,
      PrefetchHooks Function({
        bool driverSeasonEntriesRefs,
        bool constructorSeasonEntriesRefs,
        bool driverStandingsRefs,
        bool constructorStandingsRefs,
        bool raceResultEntriesRefs,
        bool constructorMediaRefs,
      })
    >;
typedef $$DriverSeasonEntriesTableCreateCompanionBuilder =
    DriverSeasonEntriesCompanion Function({
      required String id,
      required int season,
      required String driverId,
      required String constructorId,
      Value<int?> raceNumber,
      Value<String?> role,
      Value<String?> shortCode,
      Value<int?> startRound,
      Value<int?> endRound,
      Value<int> rowid,
    });
typedef $$DriverSeasonEntriesTableUpdateCompanionBuilder =
    DriverSeasonEntriesCompanion Function({
      Value<String> id,
      Value<int> season,
      Value<String> driverId,
      Value<String> constructorId,
      Value<int?> raceNumber,
      Value<String?> role,
      Value<String?> shortCode,
      Value<int?> startRound,
      Value<int?> endRound,
      Value<int> rowid,
    });

final class $$DriverSeasonEntriesTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $DriverSeasonEntriesTable,
          DriverSeasonEntryRow
        > {
  $$DriverSeasonEntriesTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $SeasonsTable _seasonTable(_$GridViewDatabase db) =>
      db.seasons.createAlias('driver_season_entries__season__seasons__year');

  $$SeasonsTableProcessedTableManager get season {
    final $_column = $_itemColumn<int>('season')!;

    final manager = $$SeasonsTableTableManager(
      $_db,
      $_db.seasons,
    ).filter((f) => f.year.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_seasonTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $DriversTable _driverIdTable(_$GridViewDatabase db) =>
      db.drivers.createAlias('driver_season_entries__driver_id__drivers__id');

  $$DriversTableProcessedTableManager get driverId {
    final $_column = $_itemColumn<String>('driver_id')!;

    final manager = $$DriversTableTableManager(
      $_db,
      $_db.drivers,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_driverIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $ConstructorsTable _constructorIdTable(_$GridViewDatabase db) => db
      .constructors
      .createAlias('driver_season_entries__constructor_id__constructors__id');

  $$ConstructorsTableProcessedTableManager get constructorId {
    final $_column = $_itemColumn<String>('constructor_id')!;

    final manager = $$ConstructorsTableTableManager(
      $_db,
      $_db.constructors,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_constructorIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$DriverSeasonEntriesTableFilterComposer
    extends Composer<_$GridViewDatabase, $DriverSeasonEntriesTable> {
  $$DriverSeasonEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get raceNumber => $composableBuilder(
    column: $table.raceNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get role => $composableBuilder(
    column: $table.role,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get shortCode => $composableBuilder(
    column: $table.shortCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get startRound => $composableBuilder(
    column: $table.startRound,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get endRound => $composableBuilder(
    column: $table.endRound,
    builder: (column) => ColumnFilters(column),
  );

  $$SeasonsTableFilterComposer get season {
    final $$SeasonsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableFilterComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableFilterComposer get driverId {
    final $$DriversTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableFilterComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableFilterComposer get constructorId {
    final $$ConstructorsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableFilterComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverSeasonEntriesTableOrderingComposer
    extends Composer<_$GridViewDatabase, $DriverSeasonEntriesTable> {
  $$DriverSeasonEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get raceNumber => $composableBuilder(
    column: $table.raceNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get role => $composableBuilder(
    column: $table.role,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get shortCode => $composableBuilder(
    column: $table.shortCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get startRound => $composableBuilder(
    column: $table.startRound,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get endRound => $composableBuilder(
    column: $table.endRound,
    builder: (column) => ColumnOrderings(column),
  );

  $$SeasonsTableOrderingComposer get season {
    final $$SeasonsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableOrderingComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableOrderingComposer get driverId {
    final $$DriversTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableOrderingComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableOrderingComposer get constructorId {
    final $$ConstructorsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableOrderingComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverSeasonEntriesTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $DriverSeasonEntriesTable> {
  $$DriverSeasonEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get raceNumber => $composableBuilder(
    column: $table.raceNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get role =>
      $composableBuilder(column: $table.role, builder: (column) => column);

  GeneratedColumn<String> get shortCode =>
      $composableBuilder(column: $table.shortCode, builder: (column) => column);

  GeneratedColumn<int> get startRound => $composableBuilder(
    column: $table.startRound,
    builder: (column) => column,
  );

  GeneratedColumn<int> get endRound =>
      $composableBuilder(column: $table.endRound, builder: (column) => column);

  $$SeasonsTableAnnotationComposer get season {
    final $$SeasonsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableAnnotationComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableAnnotationComposer get driverId {
    final $$DriversTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableAnnotationComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableAnnotationComposer get constructorId {
    final $$ConstructorsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableAnnotationComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverSeasonEntriesTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $DriverSeasonEntriesTable,
          DriverSeasonEntryRow,
          $$DriverSeasonEntriesTableFilterComposer,
          $$DriverSeasonEntriesTableOrderingComposer,
          $$DriverSeasonEntriesTableAnnotationComposer,
          $$DriverSeasonEntriesTableCreateCompanionBuilder,
          $$DriverSeasonEntriesTableUpdateCompanionBuilder,
          (DriverSeasonEntryRow, $$DriverSeasonEntriesTableReferences),
          DriverSeasonEntryRow,
          PrefetchHooks Function({
            bool season,
            bool driverId,
            bool constructorId,
          })
        > {
  $$DriverSeasonEntriesTableTableManager(
    _$GridViewDatabase db,
    $DriverSeasonEntriesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DriverSeasonEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DriverSeasonEntriesTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$DriverSeasonEntriesTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<int> season = const Value.absent(),
                Value<String> driverId = const Value.absent(),
                Value<String> constructorId = const Value.absent(),
                Value<int?> raceNumber = const Value.absent(),
                Value<String?> role = const Value.absent(),
                Value<String?> shortCode = const Value.absent(),
                Value<int?> startRound = const Value.absent(),
                Value<int?> endRound = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DriverSeasonEntriesCompanion(
                id: id,
                season: season,
                driverId: driverId,
                constructorId: constructorId,
                raceNumber: raceNumber,
                role: role,
                shortCode: shortCode,
                startRound: startRound,
                endRound: endRound,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required int season,
                required String driverId,
                required String constructorId,
                Value<int?> raceNumber = const Value.absent(),
                Value<String?> role = const Value.absent(),
                Value<String?> shortCode = const Value.absent(),
                Value<int?> startRound = const Value.absent(),
                Value<int?> endRound = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DriverSeasonEntriesCompanion.insert(
                id: id,
                season: season,
                driverId: driverId,
                constructorId: constructorId,
                raceNumber: raceNumber,
                role: role,
                shortCode: shortCode,
                startRound: startRound,
                endRound: endRound,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$DriverSeasonEntriesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({season = false, driverId = false, constructorId = false}) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [],
                  addJoins:
                      <
                        T extends TableManagerState<
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic
                        >
                      >(state) {
                        if (season) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.season,
                                    referencedTable:
                                        $$DriverSeasonEntriesTableReferences
                                            ._seasonTable(db),
                                    referencedColumn:
                                        $$DriverSeasonEntriesTableReferences
                                            ._seasonTable(db)
                                            .year,
                                  )
                                  as T;
                        }
                        if (driverId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.driverId,
                                    referencedTable:
                                        $$DriverSeasonEntriesTableReferences
                                            ._driverIdTable(db),
                                    referencedColumn:
                                        $$DriverSeasonEntriesTableReferences
                                            ._driverIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }
                        if (constructorId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.constructorId,
                                    referencedTable:
                                        $$DriverSeasonEntriesTableReferences
                                            ._constructorIdTable(db),
                                    referencedColumn:
                                        $$DriverSeasonEntriesTableReferences
                                            ._constructorIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }

                        return state;
                      },
                  getPrefetchedDataCallback: (items) async {
                    return [];
                  },
                );
              },
        ),
      );
}

typedef $$DriverSeasonEntriesTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $DriverSeasonEntriesTable,
      DriverSeasonEntryRow,
      $$DriverSeasonEntriesTableFilterComposer,
      $$DriverSeasonEntriesTableOrderingComposer,
      $$DriverSeasonEntriesTableAnnotationComposer,
      $$DriverSeasonEntriesTableCreateCompanionBuilder,
      $$DriverSeasonEntriesTableUpdateCompanionBuilder,
      (DriverSeasonEntryRow, $$DriverSeasonEntriesTableReferences),
      DriverSeasonEntryRow,
      PrefetchHooks Function({bool season, bool driverId, bool constructorId})
    >;
typedef $$ConstructorSeasonEntriesTableCreateCompanionBuilder =
    ConstructorSeasonEntriesCompanion Function({
      required String id,
      required int season,
      required String constructorId,
      Value<String?> fullName,
      Value<String?> shortName,
      Value<String?> colorPrimary,
      Value<String?> colorSecondary,
      Value<String?> powerUnit,
      Value<String?> teamPrincipal,
      Value<String?> base,
      Value<String?> chassis,
      Value<int> rowid,
    });
typedef $$ConstructorSeasonEntriesTableUpdateCompanionBuilder =
    ConstructorSeasonEntriesCompanion Function({
      Value<String> id,
      Value<int> season,
      Value<String> constructorId,
      Value<String?> fullName,
      Value<String?> shortName,
      Value<String?> colorPrimary,
      Value<String?> colorSecondary,
      Value<String?> powerUnit,
      Value<String?> teamPrincipal,
      Value<String?> base,
      Value<String?> chassis,
      Value<int> rowid,
    });

final class $$ConstructorSeasonEntriesTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $ConstructorSeasonEntriesTable,
          ConstructorSeasonEntryRow
        > {
  $$ConstructorSeasonEntriesTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $SeasonsTable _seasonTable(_$GridViewDatabase db) => db.seasons
      .createAlias('constructor_season_entries__season__seasons__year');

  $$SeasonsTableProcessedTableManager get season {
    final $_column = $_itemColumn<int>('season')!;

    final manager = $$SeasonsTableTableManager(
      $_db,
      $_db.seasons,
    ).filter((f) => f.year.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_seasonTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $ConstructorsTable _constructorIdTable(_$GridViewDatabase db) =>
      db.constructors.createAlias(
        'constructor_season_entries__constructor_id__constructors__id',
      );

  $$ConstructorsTableProcessedTableManager get constructorId {
    final $_column = $_itemColumn<String>('constructor_id')!;

    final manager = $$ConstructorsTableTableManager(
      $_db,
      $_db.constructors,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_constructorIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$ConstructorSeasonEntriesTableFilterComposer
    extends Composer<_$GridViewDatabase, $ConstructorSeasonEntriesTable> {
  $$ConstructorSeasonEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fullName => $composableBuilder(
    column: $table.fullName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get shortName => $composableBuilder(
    column: $table.shortName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get colorPrimary => $composableBuilder(
    column: $table.colorPrimary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get colorSecondary => $composableBuilder(
    column: $table.colorSecondary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get powerUnit => $composableBuilder(
    column: $table.powerUnit,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get teamPrincipal => $composableBuilder(
    column: $table.teamPrincipal,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get base => $composableBuilder(
    column: $table.base,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get chassis => $composableBuilder(
    column: $table.chassis,
    builder: (column) => ColumnFilters(column),
  );

  $$SeasonsTableFilterComposer get season {
    final $$SeasonsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableFilterComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableFilterComposer get constructorId {
    final $$ConstructorsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableFilterComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorSeasonEntriesTableOrderingComposer
    extends Composer<_$GridViewDatabase, $ConstructorSeasonEntriesTable> {
  $$ConstructorSeasonEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fullName => $composableBuilder(
    column: $table.fullName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get shortName => $composableBuilder(
    column: $table.shortName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get colorPrimary => $composableBuilder(
    column: $table.colorPrimary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get colorSecondary => $composableBuilder(
    column: $table.colorSecondary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get powerUnit => $composableBuilder(
    column: $table.powerUnit,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get teamPrincipal => $composableBuilder(
    column: $table.teamPrincipal,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get base => $composableBuilder(
    column: $table.base,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get chassis => $composableBuilder(
    column: $table.chassis,
    builder: (column) => ColumnOrderings(column),
  );

  $$SeasonsTableOrderingComposer get season {
    final $$SeasonsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableOrderingComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableOrderingComposer get constructorId {
    final $$ConstructorsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableOrderingComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorSeasonEntriesTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $ConstructorSeasonEntriesTable> {
  $$ConstructorSeasonEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get fullName =>
      $composableBuilder(column: $table.fullName, builder: (column) => column);

  GeneratedColumn<String> get shortName =>
      $composableBuilder(column: $table.shortName, builder: (column) => column);

  GeneratedColumn<String> get colorPrimary => $composableBuilder(
    column: $table.colorPrimary,
    builder: (column) => column,
  );

  GeneratedColumn<String> get colorSecondary => $composableBuilder(
    column: $table.colorSecondary,
    builder: (column) => column,
  );

  GeneratedColumn<String> get powerUnit =>
      $composableBuilder(column: $table.powerUnit, builder: (column) => column);

  GeneratedColumn<String> get teamPrincipal => $composableBuilder(
    column: $table.teamPrincipal,
    builder: (column) => column,
  );

  GeneratedColumn<String> get base =>
      $composableBuilder(column: $table.base, builder: (column) => column);

  GeneratedColumn<String> get chassis =>
      $composableBuilder(column: $table.chassis, builder: (column) => column);

  $$SeasonsTableAnnotationComposer get season {
    final $$SeasonsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableAnnotationComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableAnnotationComposer get constructorId {
    final $$ConstructorsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableAnnotationComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorSeasonEntriesTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $ConstructorSeasonEntriesTable,
          ConstructorSeasonEntryRow,
          $$ConstructorSeasonEntriesTableFilterComposer,
          $$ConstructorSeasonEntriesTableOrderingComposer,
          $$ConstructorSeasonEntriesTableAnnotationComposer,
          $$ConstructorSeasonEntriesTableCreateCompanionBuilder,
          $$ConstructorSeasonEntriesTableUpdateCompanionBuilder,
          (
            ConstructorSeasonEntryRow,
            $$ConstructorSeasonEntriesTableReferences,
          ),
          ConstructorSeasonEntryRow,
          PrefetchHooks Function({bool season, bool constructorId})
        > {
  $$ConstructorSeasonEntriesTableTableManager(
    _$GridViewDatabase db,
    $ConstructorSeasonEntriesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ConstructorSeasonEntriesTableFilterComposer(
                $db: db,
                $table: table,
              ),
          createOrderingComposer: () =>
              $$ConstructorSeasonEntriesTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$ConstructorSeasonEntriesTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<int> season = const Value.absent(),
                Value<String> constructorId = const Value.absent(),
                Value<String?> fullName = const Value.absent(),
                Value<String?> shortName = const Value.absent(),
                Value<String?> colorPrimary = const Value.absent(),
                Value<String?> colorSecondary = const Value.absent(),
                Value<String?> powerUnit = const Value.absent(),
                Value<String?> teamPrincipal = const Value.absent(),
                Value<String?> base = const Value.absent(),
                Value<String?> chassis = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ConstructorSeasonEntriesCompanion(
                id: id,
                season: season,
                constructorId: constructorId,
                fullName: fullName,
                shortName: shortName,
                colorPrimary: colorPrimary,
                colorSecondary: colorSecondary,
                powerUnit: powerUnit,
                teamPrincipal: teamPrincipal,
                base: base,
                chassis: chassis,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required int season,
                required String constructorId,
                Value<String?> fullName = const Value.absent(),
                Value<String?> shortName = const Value.absent(),
                Value<String?> colorPrimary = const Value.absent(),
                Value<String?> colorSecondary = const Value.absent(),
                Value<String?> powerUnit = const Value.absent(),
                Value<String?> teamPrincipal = const Value.absent(),
                Value<String?> base = const Value.absent(),
                Value<String?> chassis = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ConstructorSeasonEntriesCompanion.insert(
                id: id,
                season: season,
                constructorId: constructorId,
                fullName: fullName,
                shortName: shortName,
                colorPrimary: colorPrimary,
                colorSecondary: colorSecondary,
                powerUnit: powerUnit,
                teamPrincipal: teamPrincipal,
                base: base,
                chassis: chassis,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$ConstructorSeasonEntriesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({season = false, constructorId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (season) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.season,
                                referencedTable:
                                    $$ConstructorSeasonEntriesTableReferences
                                        ._seasonTable(db),
                                referencedColumn:
                                    $$ConstructorSeasonEntriesTableReferences
                                        ._seasonTable(db)
                                        .year,
                              )
                              as T;
                    }
                    if (constructorId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.constructorId,
                                referencedTable:
                                    $$ConstructorSeasonEntriesTableReferences
                                        ._constructorIdTable(db),
                                referencedColumn:
                                    $$ConstructorSeasonEntriesTableReferences
                                        ._constructorIdTable(db)
                                        .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$ConstructorSeasonEntriesTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $ConstructorSeasonEntriesTable,
      ConstructorSeasonEntryRow,
      $$ConstructorSeasonEntriesTableFilterComposer,
      $$ConstructorSeasonEntriesTableOrderingComposer,
      $$ConstructorSeasonEntriesTableAnnotationComposer,
      $$ConstructorSeasonEntriesTableCreateCompanionBuilder,
      $$ConstructorSeasonEntriesTableUpdateCompanionBuilder,
      (ConstructorSeasonEntryRow, $$ConstructorSeasonEntriesTableReferences),
      ConstructorSeasonEntryRow,
      PrefetchHooks Function({bool season, bool constructorId})
    >;
typedef $$DriverStandingsTableCreateCompanionBuilder =
    DriverStandingsCompanion Function({
      required int season,
      required String driverId,
      Value<String?> constructorId,
      Value<int?> position,
      required double points,
      Value<int?> wins,
      Value<int?> podiums,
      Value<bool?> provisional,
      required int orderIndex,
      Value<int> rowid,
    });
typedef $$DriverStandingsTableUpdateCompanionBuilder =
    DriverStandingsCompanion Function({
      Value<int> season,
      Value<String> driverId,
      Value<String?> constructorId,
      Value<int?> position,
      Value<double> points,
      Value<int?> wins,
      Value<int?> podiums,
      Value<bool?> provisional,
      Value<int> orderIndex,
      Value<int> rowid,
    });

final class $$DriverStandingsTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $DriverStandingsTable,
          DriverStandingRow
        > {
  $$DriverStandingsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $SeasonsTable _seasonTable(_$GridViewDatabase db) =>
      db.seasons.createAlias('driver_standings__season__seasons__year');

  $$SeasonsTableProcessedTableManager get season {
    final $_column = $_itemColumn<int>('season')!;

    final manager = $$SeasonsTableTableManager(
      $_db,
      $_db.seasons,
    ).filter((f) => f.year.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_seasonTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $DriversTable _driverIdTable(_$GridViewDatabase db) =>
      db.drivers.createAlias('driver_standings__driver_id__drivers__id');

  $$DriversTableProcessedTableManager get driverId {
    final $_column = $_itemColumn<String>('driver_id')!;

    final manager = $$DriversTableTableManager(
      $_db,
      $_db.drivers,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_driverIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $ConstructorsTable _constructorIdTable(_$GridViewDatabase db) => db
      .constructors
      .createAlias('driver_standings__constructor_id__constructors__id');

  $$ConstructorsTableProcessedTableManager? get constructorId {
    final $_column = $_itemColumn<String>('constructor_id');
    if ($_column == null) return null;
    final manager = $$ConstructorsTableTableManager(
      $_db,
      $_db.constructors,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_constructorIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$DriverStandingsTableFilterComposer
    extends Composer<_$GridViewDatabase, $DriverStandingsTable> {
  $$DriverStandingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get position => $composableBuilder(
    column: $table.position,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get points => $composableBuilder(
    column: $table.points,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get wins => $composableBuilder(
    column: $table.wins,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get podiums => $composableBuilder(
    column: $table.podiums,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get provisional => $composableBuilder(
    column: $table.provisional,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnFilters(column),
  );

  $$SeasonsTableFilterComposer get season {
    final $$SeasonsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableFilterComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableFilterComposer get driverId {
    final $$DriversTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableFilterComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableFilterComposer get constructorId {
    final $$ConstructorsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableFilterComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverStandingsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $DriverStandingsTable> {
  $$DriverStandingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get position => $composableBuilder(
    column: $table.position,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get points => $composableBuilder(
    column: $table.points,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get wins => $composableBuilder(
    column: $table.wins,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get podiums => $composableBuilder(
    column: $table.podiums,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get provisional => $composableBuilder(
    column: $table.provisional,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnOrderings(column),
  );

  $$SeasonsTableOrderingComposer get season {
    final $$SeasonsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableOrderingComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableOrderingComposer get driverId {
    final $$DriversTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableOrderingComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableOrderingComposer get constructorId {
    final $$ConstructorsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableOrderingComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverStandingsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $DriverStandingsTable> {
  $$DriverStandingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get position =>
      $composableBuilder(column: $table.position, builder: (column) => column);

  GeneratedColumn<double> get points =>
      $composableBuilder(column: $table.points, builder: (column) => column);

  GeneratedColumn<int> get wins =>
      $composableBuilder(column: $table.wins, builder: (column) => column);

  GeneratedColumn<int> get podiums =>
      $composableBuilder(column: $table.podiums, builder: (column) => column);

  GeneratedColumn<bool> get provisional => $composableBuilder(
    column: $table.provisional,
    builder: (column) => column,
  );

  GeneratedColumn<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => column,
  );

  $$SeasonsTableAnnotationComposer get season {
    final $$SeasonsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableAnnotationComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableAnnotationComposer get driverId {
    final $$DriversTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableAnnotationComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableAnnotationComposer get constructorId {
    final $$ConstructorsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableAnnotationComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverStandingsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $DriverStandingsTable,
          DriverStandingRow,
          $$DriverStandingsTableFilterComposer,
          $$DriverStandingsTableOrderingComposer,
          $$DriverStandingsTableAnnotationComposer,
          $$DriverStandingsTableCreateCompanionBuilder,
          $$DriverStandingsTableUpdateCompanionBuilder,
          (DriverStandingRow, $$DriverStandingsTableReferences),
          DriverStandingRow,
          PrefetchHooks Function({
            bool season,
            bool driverId,
            bool constructorId,
          })
        > {
  $$DriverStandingsTableTableManager(
    _$GridViewDatabase db,
    $DriverStandingsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DriverStandingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DriverStandingsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DriverStandingsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> season = const Value.absent(),
                Value<String> driverId = const Value.absent(),
                Value<String?> constructorId = const Value.absent(),
                Value<int?> position = const Value.absent(),
                Value<double> points = const Value.absent(),
                Value<int?> wins = const Value.absent(),
                Value<int?> podiums = const Value.absent(),
                Value<bool?> provisional = const Value.absent(),
                Value<int> orderIndex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DriverStandingsCompanion(
                season: season,
                driverId: driverId,
                constructorId: constructorId,
                position: position,
                points: points,
                wins: wins,
                podiums: podiums,
                provisional: provisional,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required int season,
                required String driverId,
                Value<String?> constructorId = const Value.absent(),
                Value<int?> position = const Value.absent(),
                required double points,
                Value<int?> wins = const Value.absent(),
                Value<int?> podiums = const Value.absent(),
                Value<bool?> provisional = const Value.absent(),
                required int orderIndex,
                Value<int> rowid = const Value.absent(),
              }) => DriverStandingsCompanion.insert(
                season: season,
                driverId: driverId,
                constructorId: constructorId,
                position: position,
                points: points,
                wins: wins,
                podiums: podiums,
                provisional: provisional,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$DriverStandingsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({season = false, driverId = false, constructorId = false}) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [],
                  addJoins:
                      <
                        T extends TableManagerState<
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic
                        >
                      >(state) {
                        if (season) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.season,
                                    referencedTable:
                                        $$DriverStandingsTableReferences
                                            ._seasonTable(db),
                                    referencedColumn:
                                        $$DriverStandingsTableReferences
                                            ._seasonTable(db)
                                            .year,
                                  )
                                  as T;
                        }
                        if (driverId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.driverId,
                                    referencedTable:
                                        $$DriverStandingsTableReferences
                                            ._driverIdTable(db),
                                    referencedColumn:
                                        $$DriverStandingsTableReferences
                                            ._driverIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }
                        if (constructorId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.constructorId,
                                    referencedTable:
                                        $$DriverStandingsTableReferences
                                            ._constructorIdTable(db),
                                    referencedColumn:
                                        $$DriverStandingsTableReferences
                                            ._constructorIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }

                        return state;
                      },
                  getPrefetchedDataCallback: (items) async {
                    return [];
                  },
                );
              },
        ),
      );
}

typedef $$DriverStandingsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $DriverStandingsTable,
      DriverStandingRow,
      $$DriverStandingsTableFilterComposer,
      $$DriverStandingsTableOrderingComposer,
      $$DriverStandingsTableAnnotationComposer,
      $$DriverStandingsTableCreateCompanionBuilder,
      $$DriverStandingsTableUpdateCompanionBuilder,
      (DriverStandingRow, $$DriverStandingsTableReferences),
      DriverStandingRow,
      PrefetchHooks Function({bool season, bool driverId, bool constructorId})
    >;
typedef $$ConstructorStandingsTableCreateCompanionBuilder =
    ConstructorStandingsCompanion Function({
      required int season,
      required String constructorId,
      Value<int?> position,
      required double points,
      Value<int?> wins,
      Value<bool?> provisional,
      required int orderIndex,
      Value<int> rowid,
    });
typedef $$ConstructorStandingsTableUpdateCompanionBuilder =
    ConstructorStandingsCompanion Function({
      Value<int> season,
      Value<String> constructorId,
      Value<int?> position,
      Value<double> points,
      Value<int?> wins,
      Value<bool?> provisional,
      Value<int> orderIndex,
      Value<int> rowid,
    });

final class $$ConstructorStandingsTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $ConstructorStandingsTable,
          ConstructorStandingRow
        > {
  $$ConstructorStandingsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $SeasonsTable _seasonTable(_$GridViewDatabase db) =>
      db.seasons.createAlias('constructor_standings__season__seasons__year');

  $$SeasonsTableProcessedTableManager get season {
    final $_column = $_itemColumn<int>('season')!;

    final manager = $$SeasonsTableTableManager(
      $_db,
      $_db.seasons,
    ).filter((f) => f.year.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_seasonTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $ConstructorsTable _constructorIdTable(_$GridViewDatabase db) => db
      .constructors
      .createAlias('constructor_standings__constructor_id__constructors__id');

  $$ConstructorsTableProcessedTableManager get constructorId {
    final $_column = $_itemColumn<String>('constructor_id')!;

    final manager = $$ConstructorsTableTableManager(
      $_db,
      $_db.constructors,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_constructorIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$ConstructorStandingsTableFilterComposer
    extends Composer<_$GridViewDatabase, $ConstructorStandingsTable> {
  $$ConstructorStandingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get position => $composableBuilder(
    column: $table.position,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get points => $composableBuilder(
    column: $table.points,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get wins => $composableBuilder(
    column: $table.wins,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get provisional => $composableBuilder(
    column: $table.provisional,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnFilters(column),
  );

  $$SeasonsTableFilterComposer get season {
    final $$SeasonsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableFilterComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableFilterComposer get constructorId {
    final $$ConstructorsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableFilterComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorStandingsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $ConstructorStandingsTable> {
  $$ConstructorStandingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get position => $composableBuilder(
    column: $table.position,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get points => $composableBuilder(
    column: $table.points,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get wins => $composableBuilder(
    column: $table.wins,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get provisional => $composableBuilder(
    column: $table.provisional,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnOrderings(column),
  );

  $$SeasonsTableOrderingComposer get season {
    final $$SeasonsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableOrderingComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableOrderingComposer get constructorId {
    final $$ConstructorsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableOrderingComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorStandingsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $ConstructorStandingsTable> {
  $$ConstructorStandingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get position =>
      $composableBuilder(column: $table.position, builder: (column) => column);

  GeneratedColumn<double> get points =>
      $composableBuilder(column: $table.points, builder: (column) => column);

  GeneratedColumn<int> get wins =>
      $composableBuilder(column: $table.wins, builder: (column) => column);

  GeneratedColumn<bool> get provisional => $composableBuilder(
    column: $table.provisional,
    builder: (column) => column,
  );

  GeneratedColumn<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => column,
  );

  $$SeasonsTableAnnotationComposer get season {
    final $$SeasonsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.season,
      referencedTable: $db.seasons,
      getReferencedColumn: (t) => t.year,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SeasonsTableAnnotationComposer(
            $db: $db,
            $table: $db.seasons,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableAnnotationComposer get constructorId {
    final $$ConstructorsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableAnnotationComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorStandingsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $ConstructorStandingsTable,
          ConstructorStandingRow,
          $$ConstructorStandingsTableFilterComposer,
          $$ConstructorStandingsTableOrderingComposer,
          $$ConstructorStandingsTableAnnotationComposer,
          $$ConstructorStandingsTableCreateCompanionBuilder,
          $$ConstructorStandingsTableUpdateCompanionBuilder,
          (ConstructorStandingRow, $$ConstructorStandingsTableReferences),
          ConstructorStandingRow,
          PrefetchHooks Function({bool season, bool constructorId})
        > {
  $$ConstructorStandingsTableTableManager(
    _$GridViewDatabase db,
    $ConstructorStandingsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ConstructorStandingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ConstructorStandingsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$ConstructorStandingsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<int> season = const Value.absent(),
                Value<String> constructorId = const Value.absent(),
                Value<int?> position = const Value.absent(),
                Value<double> points = const Value.absent(),
                Value<int?> wins = const Value.absent(),
                Value<bool?> provisional = const Value.absent(),
                Value<int> orderIndex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ConstructorStandingsCompanion(
                season: season,
                constructorId: constructorId,
                position: position,
                points: points,
                wins: wins,
                provisional: provisional,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required int season,
                required String constructorId,
                Value<int?> position = const Value.absent(),
                required double points,
                Value<int?> wins = const Value.absent(),
                Value<bool?> provisional = const Value.absent(),
                required int orderIndex,
                Value<int> rowid = const Value.absent(),
              }) => ConstructorStandingsCompanion.insert(
                season: season,
                constructorId: constructorId,
                position: position,
                points: points,
                wins: wins,
                provisional: provisional,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$ConstructorStandingsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({season = false, constructorId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (season) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.season,
                                referencedTable:
                                    $$ConstructorStandingsTableReferences
                                        ._seasonTable(db),
                                referencedColumn:
                                    $$ConstructorStandingsTableReferences
                                        ._seasonTable(db)
                                        .year,
                              )
                              as T;
                    }
                    if (constructorId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.constructorId,
                                referencedTable:
                                    $$ConstructorStandingsTableReferences
                                        ._constructorIdTable(db),
                                referencedColumn:
                                    $$ConstructorStandingsTableReferences
                                        ._constructorIdTable(db)
                                        .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$ConstructorStandingsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $ConstructorStandingsTable,
      ConstructorStandingRow,
      $$ConstructorStandingsTableFilterComposer,
      $$ConstructorStandingsTableOrderingComposer,
      $$ConstructorStandingsTableAnnotationComposer,
      $$ConstructorStandingsTableCreateCompanionBuilder,
      $$ConstructorStandingsTableUpdateCompanionBuilder,
      (ConstructorStandingRow, $$ConstructorStandingsTableReferences),
      ConstructorStandingRow,
      PrefetchHooks Function({bool season, bool constructorId})
    >;
typedef $$RaceResultsTableCreateCompanionBuilder =
    RaceResultsCompanion Function({
      required String id,
      required int season,
      required int round,
      required String grandPrixId,
      required String sessionType,
      required String status,
      Value<String?> fastestLapDriverId,
      Value<int?> fastestLapTimeMillis,
      Value<int?> fastestLapLap,
      Value<int> rowid,
    });
typedef $$RaceResultsTableUpdateCompanionBuilder =
    RaceResultsCompanion Function({
      Value<String> id,
      Value<int> season,
      Value<int> round,
      Value<String> grandPrixId,
      Value<String> sessionType,
      Value<String> status,
      Value<String?> fastestLapDriverId,
      Value<int?> fastestLapTimeMillis,
      Value<int?> fastestLapLap,
      Value<int> rowid,
    });

final class $$RaceResultsTableReferences
    extends
        BaseReferences<_$GridViewDatabase, $RaceResultsTable, RaceResultRow> {
  $$RaceResultsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $GrandPrixEventsTable _grandPrixIdTable(_$GridViewDatabase db) => db
      .grandPrixEvents
      .createAlias('race_results__grand_prix_id__grand_prix__id');

  $$GrandPrixEventsTableProcessedTableManager get grandPrixId {
    final $_column = $_itemColumn<String>('grand_prix_id')!;

    final manager = $$GrandPrixEventsTableTableManager(
      $_db,
      $_db.grandPrixEvents,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_grandPrixIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static MultiTypedResultKey<$RaceResultEntriesTable, List<RaceResultEntryRow>>
  _raceResultEntriesRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.raceResultEntries,
        aliasName: 'race_results__id__race_result_entries__race_result_id',
      );

  $$RaceResultEntriesTableProcessedTableManager get raceResultEntriesRefs {
    final manager = $$RaceResultEntriesTableTableManager(
      $_db,
      $_db.raceResultEntries,
    ).filter((f) => f.raceResultId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _raceResultEntriesRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$RaceResultsTableFilterComposer
    extends Composer<_$GridViewDatabase, $RaceResultsTable> {
  $$RaceResultsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get season => $composableBuilder(
    column: $table.season,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get round => $composableBuilder(
    column: $table.round,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sessionType => $composableBuilder(
    column: $table.sessionType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fastestLapDriverId => $composableBuilder(
    column: $table.fastestLapDriverId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get fastestLapTimeMillis => $composableBuilder(
    column: $table.fastestLapTimeMillis,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get fastestLapLap => $composableBuilder(
    column: $table.fastestLapLap,
    builder: (column) => ColumnFilters(column),
  );

  $$GrandPrixEventsTableFilterComposer get grandPrixId {
    final $$GrandPrixEventsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableFilterComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  Expression<bool> raceResultEntriesRefs(
    Expression<bool> Function($$RaceResultEntriesTableFilterComposer f) f,
  ) {
    final $$RaceResultEntriesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.raceResultEntries,
      getReferencedColumn: (t) => t.raceResultId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RaceResultEntriesTableFilterComposer(
            $db: $db,
            $table: $db.raceResultEntries,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$RaceResultsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $RaceResultsTable> {
  $$RaceResultsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get season => $composableBuilder(
    column: $table.season,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get round => $composableBuilder(
    column: $table.round,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sessionType => $composableBuilder(
    column: $table.sessionType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fastestLapDriverId => $composableBuilder(
    column: $table.fastestLapDriverId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get fastestLapTimeMillis => $composableBuilder(
    column: $table.fastestLapTimeMillis,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get fastestLapLap => $composableBuilder(
    column: $table.fastestLapLap,
    builder: (column) => ColumnOrderings(column),
  );

  $$GrandPrixEventsTableOrderingComposer get grandPrixId {
    final $$GrandPrixEventsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableOrderingComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$RaceResultsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $RaceResultsTable> {
  $$RaceResultsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get season =>
      $composableBuilder(column: $table.season, builder: (column) => column);

  GeneratedColumn<int> get round =>
      $composableBuilder(column: $table.round, builder: (column) => column);

  GeneratedColumn<String> get sessionType => $composableBuilder(
    column: $table.sessionType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get fastestLapDriverId => $composableBuilder(
    column: $table.fastestLapDriverId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get fastestLapTimeMillis => $composableBuilder(
    column: $table.fastestLapTimeMillis,
    builder: (column) => column,
  );

  GeneratedColumn<int> get fastestLapLap => $composableBuilder(
    column: $table.fastestLapLap,
    builder: (column) => column,
  );

  $$GrandPrixEventsTableAnnotationComposer get grandPrixId {
    final $$GrandPrixEventsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableAnnotationComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  Expression<T> raceResultEntriesRefs<T extends Object>(
    Expression<T> Function($$RaceResultEntriesTableAnnotationComposer a) f,
  ) {
    final $$RaceResultEntriesTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.raceResultEntries,
          getReferencedColumn: (t) => t.raceResultId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$RaceResultEntriesTableAnnotationComposer(
                $db: $db,
                $table: $db.raceResultEntries,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }
}

class $$RaceResultsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $RaceResultsTable,
          RaceResultRow,
          $$RaceResultsTableFilterComposer,
          $$RaceResultsTableOrderingComposer,
          $$RaceResultsTableAnnotationComposer,
          $$RaceResultsTableCreateCompanionBuilder,
          $$RaceResultsTableUpdateCompanionBuilder,
          (RaceResultRow, $$RaceResultsTableReferences),
          RaceResultRow,
          PrefetchHooks Function({bool grandPrixId, bool raceResultEntriesRefs})
        > {
  $$RaceResultsTableTableManager(_$GridViewDatabase db, $RaceResultsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RaceResultsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RaceResultsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RaceResultsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<int> season = const Value.absent(),
                Value<int> round = const Value.absent(),
                Value<String> grandPrixId = const Value.absent(),
                Value<String> sessionType = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String?> fastestLapDriverId = const Value.absent(),
                Value<int?> fastestLapTimeMillis = const Value.absent(),
                Value<int?> fastestLapLap = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RaceResultsCompanion(
                id: id,
                season: season,
                round: round,
                grandPrixId: grandPrixId,
                sessionType: sessionType,
                status: status,
                fastestLapDriverId: fastestLapDriverId,
                fastestLapTimeMillis: fastestLapTimeMillis,
                fastestLapLap: fastestLapLap,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required int season,
                required int round,
                required String grandPrixId,
                required String sessionType,
                required String status,
                Value<String?> fastestLapDriverId = const Value.absent(),
                Value<int?> fastestLapTimeMillis = const Value.absent(),
                Value<int?> fastestLapLap = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RaceResultsCompanion.insert(
                id: id,
                season: season,
                round: round,
                grandPrixId: grandPrixId,
                sessionType: sessionType,
                status: status,
                fastestLapDriverId: fastestLapDriverId,
                fastestLapTimeMillis: fastestLapTimeMillis,
                fastestLapLap: fastestLapLap,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$RaceResultsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({grandPrixId = false, raceResultEntriesRefs = false}) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (raceResultEntriesRefs) db.raceResultEntries,
                  ],
                  addJoins:
                      <
                        T extends TableManagerState<
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic
                        >
                      >(state) {
                        if (grandPrixId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.grandPrixId,
                                    referencedTable:
                                        $$RaceResultsTableReferences
                                            ._grandPrixIdTable(db),
                                    referencedColumn:
                                        $$RaceResultsTableReferences
                                            ._grandPrixIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }

                        return state;
                      },
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (raceResultEntriesRefs)
                        await $_getPrefetchedData<
                          RaceResultRow,
                          $RaceResultsTable,
                          RaceResultEntryRow
                        >(
                          currentTable: table,
                          referencedTable: $$RaceResultsTableReferences
                              ._raceResultEntriesRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$RaceResultsTableReferences(
                                db,
                                table,
                                p0,
                              ).raceResultEntriesRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.raceResultId == item.id,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$RaceResultsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $RaceResultsTable,
      RaceResultRow,
      $$RaceResultsTableFilterComposer,
      $$RaceResultsTableOrderingComposer,
      $$RaceResultsTableAnnotationComposer,
      $$RaceResultsTableCreateCompanionBuilder,
      $$RaceResultsTableUpdateCompanionBuilder,
      (RaceResultRow, $$RaceResultsTableReferences),
      RaceResultRow,
      PrefetchHooks Function({bool grandPrixId, bool raceResultEntriesRefs})
    >;
typedef $$RaceResultEntriesTableCreateCompanionBuilder =
    RaceResultEntriesCompanion Function({
      required String raceResultId,
      required String driverId,
      required String constructorId,
      Value<int?> position,
      Value<int?> gridPosition,
      Value<double?> points,
      required String status,
      Value<int?> laps,
      Value<int?> elapsedTimeMillis,
      Value<int?> gapToLeaderMillis,
      Value<int?> lapsBehind,
      Value<bool?> fastestLap,
      Value<String?> dnfReason,
      Value<String?> gapText,
      required int orderIndex,
      Value<int> rowid,
    });
typedef $$RaceResultEntriesTableUpdateCompanionBuilder =
    RaceResultEntriesCompanion Function({
      Value<String> raceResultId,
      Value<String> driverId,
      Value<String> constructorId,
      Value<int?> position,
      Value<int?> gridPosition,
      Value<double?> points,
      Value<String> status,
      Value<int?> laps,
      Value<int?> elapsedTimeMillis,
      Value<int?> gapToLeaderMillis,
      Value<int?> lapsBehind,
      Value<bool?> fastestLap,
      Value<String?> dnfReason,
      Value<String?> gapText,
      Value<int> orderIndex,
      Value<int> rowid,
    });

final class $$RaceResultEntriesTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $RaceResultEntriesTable,
          RaceResultEntryRow
        > {
  $$RaceResultEntriesTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $RaceResultsTable _raceResultIdTable(_$GridViewDatabase db) => db
      .raceResults
      .createAlias('race_result_entries__race_result_id__race_results__id');

  $$RaceResultsTableProcessedTableManager get raceResultId {
    final $_column = $_itemColumn<String>('race_result_id')!;

    final manager = $$RaceResultsTableTableManager(
      $_db,
      $_db.raceResults,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_raceResultIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $DriversTable _driverIdTable(_$GridViewDatabase db) =>
      db.drivers.createAlias('race_result_entries__driver_id__drivers__id');

  $$DriversTableProcessedTableManager get driverId {
    final $_column = $_itemColumn<String>('driver_id')!;

    final manager = $$DriversTableTableManager(
      $_db,
      $_db.drivers,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_driverIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $ConstructorsTable _constructorIdTable(_$GridViewDatabase db) => db
      .constructors
      .createAlias('race_result_entries__constructor_id__constructors__id');

  $$ConstructorsTableProcessedTableManager get constructorId {
    final $_column = $_itemColumn<String>('constructor_id')!;

    final manager = $$ConstructorsTableTableManager(
      $_db,
      $_db.constructors,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_constructorIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$RaceResultEntriesTableFilterComposer
    extends Composer<_$GridViewDatabase, $RaceResultEntriesTable> {
  $$RaceResultEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get position => $composableBuilder(
    column: $table.position,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get gridPosition => $composableBuilder(
    column: $table.gridPosition,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get points => $composableBuilder(
    column: $table.points,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get laps => $composableBuilder(
    column: $table.laps,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get elapsedTimeMillis => $composableBuilder(
    column: $table.elapsedTimeMillis,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get gapToLeaderMillis => $composableBuilder(
    column: $table.gapToLeaderMillis,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lapsBehind => $composableBuilder(
    column: $table.lapsBehind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get fastestLap => $composableBuilder(
    column: $table.fastestLap,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dnfReason => $composableBuilder(
    column: $table.dnfReason,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get gapText => $composableBuilder(
    column: $table.gapText,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnFilters(column),
  );

  $$RaceResultsTableFilterComposer get raceResultId {
    final $$RaceResultsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.raceResultId,
      referencedTable: $db.raceResults,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RaceResultsTableFilterComposer(
            $db: $db,
            $table: $db.raceResults,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableFilterComposer get driverId {
    final $$DriversTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableFilterComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableFilterComposer get constructorId {
    final $$ConstructorsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableFilterComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$RaceResultEntriesTableOrderingComposer
    extends Composer<_$GridViewDatabase, $RaceResultEntriesTable> {
  $$RaceResultEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get position => $composableBuilder(
    column: $table.position,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get gridPosition => $composableBuilder(
    column: $table.gridPosition,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get points => $composableBuilder(
    column: $table.points,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get laps => $composableBuilder(
    column: $table.laps,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get elapsedTimeMillis => $composableBuilder(
    column: $table.elapsedTimeMillis,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get gapToLeaderMillis => $composableBuilder(
    column: $table.gapToLeaderMillis,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lapsBehind => $composableBuilder(
    column: $table.lapsBehind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get fastestLap => $composableBuilder(
    column: $table.fastestLap,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dnfReason => $composableBuilder(
    column: $table.dnfReason,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get gapText => $composableBuilder(
    column: $table.gapText,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnOrderings(column),
  );

  $$RaceResultsTableOrderingComposer get raceResultId {
    final $$RaceResultsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.raceResultId,
      referencedTable: $db.raceResults,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RaceResultsTableOrderingComposer(
            $db: $db,
            $table: $db.raceResults,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableOrderingComposer get driverId {
    final $$DriversTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableOrderingComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableOrderingComposer get constructorId {
    final $$ConstructorsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableOrderingComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$RaceResultEntriesTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $RaceResultEntriesTable> {
  $$RaceResultEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get position =>
      $composableBuilder(column: $table.position, builder: (column) => column);

  GeneratedColumn<int> get gridPosition => $composableBuilder(
    column: $table.gridPosition,
    builder: (column) => column,
  );

  GeneratedColumn<double> get points =>
      $composableBuilder(column: $table.points, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get laps =>
      $composableBuilder(column: $table.laps, builder: (column) => column);

  GeneratedColumn<int> get elapsedTimeMillis => $composableBuilder(
    column: $table.elapsedTimeMillis,
    builder: (column) => column,
  );

  GeneratedColumn<int> get gapToLeaderMillis => $composableBuilder(
    column: $table.gapToLeaderMillis,
    builder: (column) => column,
  );

  GeneratedColumn<int> get lapsBehind => $composableBuilder(
    column: $table.lapsBehind,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get fastestLap => $composableBuilder(
    column: $table.fastestLap,
    builder: (column) => column,
  );

  GeneratedColumn<String> get dnfReason =>
      $composableBuilder(column: $table.dnfReason, builder: (column) => column);

  GeneratedColumn<String> get gapText =>
      $composableBuilder(column: $table.gapText, builder: (column) => column);

  GeneratedColumn<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => column,
  );

  $$RaceResultsTableAnnotationComposer get raceResultId {
    final $$RaceResultsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.raceResultId,
      referencedTable: $db.raceResults,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RaceResultsTableAnnotationComposer(
            $db: $db,
            $table: $db.raceResults,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableAnnotationComposer get driverId {
    final $$DriversTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableAnnotationComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableAnnotationComposer get constructorId {
    final $$ConstructorsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableAnnotationComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$RaceResultEntriesTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $RaceResultEntriesTable,
          RaceResultEntryRow,
          $$RaceResultEntriesTableFilterComposer,
          $$RaceResultEntriesTableOrderingComposer,
          $$RaceResultEntriesTableAnnotationComposer,
          $$RaceResultEntriesTableCreateCompanionBuilder,
          $$RaceResultEntriesTableUpdateCompanionBuilder,
          (RaceResultEntryRow, $$RaceResultEntriesTableReferences),
          RaceResultEntryRow,
          PrefetchHooks Function({
            bool raceResultId,
            bool driverId,
            bool constructorId,
          })
        > {
  $$RaceResultEntriesTableTableManager(
    _$GridViewDatabase db,
    $RaceResultEntriesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RaceResultEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RaceResultEntriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RaceResultEntriesTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> raceResultId = const Value.absent(),
                Value<String> driverId = const Value.absent(),
                Value<String> constructorId = const Value.absent(),
                Value<int?> position = const Value.absent(),
                Value<int?> gridPosition = const Value.absent(),
                Value<double?> points = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int?> laps = const Value.absent(),
                Value<int?> elapsedTimeMillis = const Value.absent(),
                Value<int?> gapToLeaderMillis = const Value.absent(),
                Value<int?> lapsBehind = const Value.absent(),
                Value<bool?> fastestLap = const Value.absent(),
                Value<String?> dnfReason = const Value.absent(),
                Value<String?> gapText = const Value.absent(),
                Value<int> orderIndex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RaceResultEntriesCompanion(
                raceResultId: raceResultId,
                driverId: driverId,
                constructorId: constructorId,
                position: position,
                gridPosition: gridPosition,
                points: points,
                status: status,
                laps: laps,
                elapsedTimeMillis: elapsedTimeMillis,
                gapToLeaderMillis: gapToLeaderMillis,
                lapsBehind: lapsBehind,
                fastestLap: fastestLap,
                dnfReason: dnfReason,
                gapText: gapText,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String raceResultId,
                required String driverId,
                required String constructorId,
                Value<int?> position = const Value.absent(),
                Value<int?> gridPosition = const Value.absent(),
                Value<double?> points = const Value.absent(),
                required String status,
                Value<int?> laps = const Value.absent(),
                Value<int?> elapsedTimeMillis = const Value.absent(),
                Value<int?> gapToLeaderMillis = const Value.absent(),
                Value<int?> lapsBehind = const Value.absent(),
                Value<bool?> fastestLap = const Value.absent(),
                Value<String?> dnfReason = const Value.absent(),
                Value<String?> gapText = const Value.absent(),
                required int orderIndex,
                Value<int> rowid = const Value.absent(),
              }) => RaceResultEntriesCompanion.insert(
                raceResultId: raceResultId,
                driverId: driverId,
                constructorId: constructorId,
                position: position,
                gridPosition: gridPosition,
                points: points,
                status: status,
                laps: laps,
                elapsedTimeMillis: elapsedTimeMillis,
                gapToLeaderMillis: gapToLeaderMillis,
                lapsBehind: lapsBehind,
                fastestLap: fastestLap,
                dnfReason: dnfReason,
                gapText: gapText,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$RaceResultEntriesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({
                raceResultId = false,
                driverId = false,
                constructorId = false,
              }) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [],
                  addJoins:
                      <
                        T extends TableManagerState<
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic
                        >
                      >(state) {
                        if (raceResultId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.raceResultId,
                                    referencedTable:
                                        $$RaceResultEntriesTableReferences
                                            ._raceResultIdTable(db),
                                    referencedColumn:
                                        $$RaceResultEntriesTableReferences
                                            ._raceResultIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }
                        if (driverId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.driverId,
                                    referencedTable:
                                        $$RaceResultEntriesTableReferences
                                            ._driverIdTable(db),
                                    referencedColumn:
                                        $$RaceResultEntriesTableReferences
                                            ._driverIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }
                        if (constructorId) {
                          state =
                              state.withJoin(
                                    currentTable: table,
                                    currentColumn: table.constructorId,
                                    referencedTable:
                                        $$RaceResultEntriesTableReferences
                                            ._constructorIdTable(db),
                                    referencedColumn:
                                        $$RaceResultEntriesTableReferences
                                            ._constructorIdTable(db)
                                            .id,
                                  )
                                  as T;
                        }

                        return state;
                      },
                  getPrefetchedDataCallback: (items) async {
                    return [];
                  },
                );
              },
        ),
      );
}

typedef $$RaceResultEntriesTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $RaceResultEntriesTable,
      RaceResultEntryRow,
      $$RaceResultEntriesTableFilterComposer,
      $$RaceResultEntriesTableOrderingComposer,
      $$RaceResultEntriesTableAnnotationComposer,
      $$RaceResultEntriesTableCreateCompanionBuilder,
      $$RaceResultEntriesTableUpdateCompanionBuilder,
      (RaceResultEntryRow, $$RaceResultEntriesTableReferences),
      RaceResultEntryRow,
      PrefetchHooks Function({
        bool raceResultId,
        bool driverId,
        bool constructorId,
      })
    >;
typedef $$MediaAssetsTableCreateCompanionBuilder =
    MediaAssetsCompanion Function({
      required String id,
      required String entityType,
      Value<String?> entityId,
      required String category,
      required String format,
      Value<double?> aspectRatio,
      required String version,
      Value<String?> attribution,
      Value<String?> license,
      Value<String?> fallbackCategory,
      Value<int> rowid,
    });
typedef $$MediaAssetsTableUpdateCompanionBuilder =
    MediaAssetsCompanion Function({
      Value<String> id,
      Value<String> entityType,
      Value<String?> entityId,
      Value<String> category,
      Value<String> format,
      Value<double?> aspectRatio,
      Value<String> version,
      Value<String?> attribution,
      Value<String?> license,
      Value<String?> fallbackCategory,
      Value<int> rowid,
    });

final class $$MediaAssetsTableReferences
    extends
        BaseReferences<_$GridViewDatabase, $MediaAssetsTable, MediaAssetRow> {
  $$MediaAssetsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$MediaAssetVariantsTable, List<MediaVariantRow>>
  _mediaAssetVariantsRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.mediaAssetVariants,
        aliasName: 'media_assets__id__media_variants__media_id',
      );

  $$MediaAssetVariantsTableProcessedTableManager get mediaAssetVariantsRefs {
    final manager = $$MediaAssetVariantsTableTableManager(
      $_db,
      $_db.mediaAssetVariants,
    ).filter((f) => f.mediaId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _mediaAssetVariantsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$DriverMediaTable, List<DriverMediaRow>>
  _driverMediaRefsTable(_$GridViewDatabase db) => MultiTypedResultKey.fromTable(
    db.driverMedia,
    aliasName: 'media_assets__id__driver_media__media_id',
  );

  $$DriverMediaTableProcessedTableManager get driverMediaRefs {
    final manager = $$DriverMediaTableTableManager(
      $_db,
      $_db.driverMedia,
    ).filter((f) => f.mediaId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_driverMediaRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$ConstructorMediaTable, List<ConstructorMediaRow>>
  _constructorMediaRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.constructorMedia,
        aliasName: 'media_assets__id__constructor_media__media_id',
      );

  $$ConstructorMediaTableProcessedTableManager get constructorMediaRefs {
    final manager = $$ConstructorMediaTableTableManager(
      $_db,
      $_db.constructorMedia,
    ).filter((f) => f.mediaId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _constructorMediaRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$CircuitMediaTable, List<CircuitMediaRow>>
  _circuitMediaRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.circuitMedia,
        aliasName: 'media_assets__id__circuit_media__media_id',
      );

  $$CircuitMediaTableProcessedTableManager get circuitMediaRefs {
    final manager = $$CircuitMediaTableTableManager(
      $_db,
      $_db.circuitMedia,
    ).filter((f) => f.mediaId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_circuitMediaRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$GrandPrixMediaTable, List<GrandPrixMediaRow>>
  _grandPrixMediaRefsTable(_$GridViewDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.grandPrixMedia,
        aliasName: 'media_assets__id__grand_prix_media__media_id',
      );

  $$GrandPrixMediaTableProcessedTableManager get grandPrixMediaRefs {
    final manager = $$GrandPrixMediaTableTableManager(
      $_db,
      $_db.grandPrixMedia,
    ).filter((f) => f.mediaId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_grandPrixMediaRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$MediaAssetsTableFilterComposer
    extends Composer<_$GridViewDatabase, $MediaAssetsTable> {
  $$MediaAssetsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get format => $composableBuilder(
    column: $table.format,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get aspectRatio => $composableBuilder(
    column: $table.aspectRatio,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get attribution => $composableBuilder(
    column: $table.attribution,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get license => $composableBuilder(
    column: $table.license,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fallbackCategory => $composableBuilder(
    column: $table.fallbackCategory,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> mediaAssetVariantsRefs(
    Expression<bool> Function($$MediaAssetVariantsTableFilterComposer f) f,
  ) {
    final $$MediaAssetVariantsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.mediaAssetVariants,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetVariantsTableFilterComposer(
            $db: $db,
            $table: $db.mediaAssetVariants,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> driverMediaRefs(
    Expression<bool> Function($$DriverMediaTableFilterComposer f) f,
  ) {
    final $$DriverMediaTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverMedia,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverMediaTableFilterComposer(
            $db: $db,
            $table: $db.driverMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> constructorMediaRefs(
    Expression<bool> Function($$ConstructorMediaTableFilterComposer f) f,
  ) {
    final $$ConstructorMediaTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.constructorMedia,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorMediaTableFilterComposer(
            $db: $db,
            $table: $db.constructorMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> circuitMediaRefs(
    Expression<bool> Function($$CircuitMediaTableFilterComposer f) f,
  ) {
    final $$CircuitMediaTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.circuitMedia,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitMediaTableFilterComposer(
            $db: $db,
            $table: $db.circuitMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> grandPrixMediaRefs(
    Expression<bool> Function($$GrandPrixMediaTableFilterComposer f) f,
  ) {
    final $$GrandPrixMediaTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.grandPrixMedia,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixMediaTableFilterComposer(
            $db: $db,
            $table: $db.grandPrixMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$MediaAssetsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $MediaAssetsTable> {
  $$MediaAssetsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get format => $composableBuilder(
    column: $table.format,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get aspectRatio => $composableBuilder(
    column: $table.aspectRatio,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get attribution => $composableBuilder(
    column: $table.attribution,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get license => $composableBuilder(
    column: $table.license,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fallbackCategory => $composableBuilder(
    column: $table.fallbackCategory,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$MediaAssetsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $MediaAssetsTable> {
  $$MediaAssetsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<String> get format =>
      $composableBuilder(column: $table.format, builder: (column) => column);

  GeneratedColumn<double> get aspectRatio => $composableBuilder(
    column: $table.aspectRatio,
    builder: (column) => column,
  );

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<String> get attribution => $composableBuilder(
    column: $table.attribution,
    builder: (column) => column,
  );

  GeneratedColumn<String> get license =>
      $composableBuilder(column: $table.license, builder: (column) => column);

  GeneratedColumn<String> get fallbackCategory => $composableBuilder(
    column: $table.fallbackCategory,
    builder: (column) => column,
  );

  Expression<T> mediaAssetVariantsRefs<T extends Object>(
    Expression<T> Function($$MediaAssetVariantsTableAnnotationComposer a) f,
  ) {
    final $$MediaAssetVariantsTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.mediaAssetVariants,
          getReferencedColumn: (t) => t.mediaId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$MediaAssetVariantsTableAnnotationComposer(
                $db: $db,
                $table: $db.mediaAssetVariants,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }

  Expression<T> driverMediaRefs<T extends Object>(
    Expression<T> Function($$DriverMediaTableAnnotationComposer a) f,
  ) {
    final $$DriverMediaTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.driverMedia,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriverMediaTableAnnotationComposer(
            $db: $db,
            $table: $db.driverMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> constructorMediaRefs<T extends Object>(
    Expression<T> Function($$ConstructorMediaTableAnnotationComposer a) f,
  ) {
    final $$ConstructorMediaTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.constructorMedia,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorMediaTableAnnotationComposer(
            $db: $db,
            $table: $db.constructorMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> circuitMediaRefs<T extends Object>(
    Expression<T> Function($$CircuitMediaTableAnnotationComposer a) f,
  ) {
    final $$CircuitMediaTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.circuitMedia,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitMediaTableAnnotationComposer(
            $db: $db,
            $table: $db.circuitMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> grandPrixMediaRefs<T extends Object>(
    Expression<T> Function($$GrandPrixMediaTableAnnotationComposer a) f,
  ) {
    final $$GrandPrixMediaTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.grandPrixMedia,
      getReferencedColumn: (t) => t.mediaId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixMediaTableAnnotationComposer(
            $db: $db,
            $table: $db.grandPrixMedia,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$MediaAssetsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $MediaAssetsTable,
          MediaAssetRow,
          $$MediaAssetsTableFilterComposer,
          $$MediaAssetsTableOrderingComposer,
          $$MediaAssetsTableAnnotationComposer,
          $$MediaAssetsTableCreateCompanionBuilder,
          $$MediaAssetsTableUpdateCompanionBuilder,
          (MediaAssetRow, $$MediaAssetsTableReferences),
          MediaAssetRow,
          PrefetchHooks Function({
            bool mediaAssetVariantsRefs,
            bool driverMediaRefs,
            bool constructorMediaRefs,
            bool circuitMediaRefs,
            bool grandPrixMediaRefs,
          })
        > {
  $$MediaAssetsTableTableManager(_$GridViewDatabase db, $MediaAssetsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$MediaAssetsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$MediaAssetsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$MediaAssetsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> entityType = const Value.absent(),
                Value<String?> entityId = const Value.absent(),
                Value<String> category = const Value.absent(),
                Value<String> format = const Value.absent(),
                Value<double?> aspectRatio = const Value.absent(),
                Value<String> version = const Value.absent(),
                Value<String?> attribution = const Value.absent(),
                Value<String?> license = const Value.absent(),
                Value<String?> fallbackCategory = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MediaAssetsCompanion(
                id: id,
                entityType: entityType,
                entityId: entityId,
                category: category,
                format: format,
                aspectRatio: aspectRatio,
                version: version,
                attribution: attribution,
                license: license,
                fallbackCategory: fallbackCategory,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String entityType,
                Value<String?> entityId = const Value.absent(),
                required String category,
                required String format,
                Value<double?> aspectRatio = const Value.absent(),
                required String version,
                Value<String?> attribution = const Value.absent(),
                Value<String?> license = const Value.absent(),
                Value<String?> fallbackCategory = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MediaAssetsCompanion.insert(
                id: id,
                entityType: entityType,
                entityId: entityId,
                category: category,
                format: format,
                aspectRatio: aspectRatio,
                version: version,
                attribution: attribution,
                license: license,
                fallbackCategory: fallbackCategory,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$MediaAssetsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({
                mediaAssetVariantsRefs = false,
                driverMediaRefs = false,
                constructorMediaRefs = false,
                circuitMediaRefs = false,
                grandPrixMediaRefs = false,
              }) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (mediaAssetVariantsRefs) db.mediaAssetVariants,
                    if (driverMediaRefs) db.driverMedia,
                    if (constructorMediaRefs) db.constructorMedia,
                    if (circuitMediaRefs) db.circuitMedia,
                    if (grandPrixMediaRefs) db.grandPrixMedia,
                  ],
                  addJoins: null,
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (mediaAssetVariantsRefs)
                        await $_getPrefetchedData<
                          MediaAssetRow,
                          $MediaAssetsTable,
                          MediaVariantRow
                        >(
                          currentTable: table,
                          referencedTable: $$MediaAssetsTableReferences
                              ._mediaAssetVariantsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$MediaAssetsTableReferences(
                                db,
                                table,
                                p0,
                              ).mediaAssetVariantsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.mediaId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (driverMediaRefs)
                        await $_getPrefetchedData<
                          MediaAssetRow,
                          $MediaAssetsTable,
                          DriverMediaRow
                        >(
                          currentTable: table,
                          referencedTable: $$MediaAssetsTableReferences
                              ._driverMediaRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$MediaAssetsTableReferences(
                                db,
                                table,
                                p0,
                              ).driverMediaRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.mediaId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (constructorMediaRefs)
                        await $_getPrefetchedData<
                          MediaAssetRow,
                          $MediaAssetsTable,
                          ConstructorMediaRow
                        >(
                          currentTable: table,
                          referencedTable: $$MediaAssetsTableReferences
                              ._constructorMediaRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$MediaAssetsTableReferences(
                                db,
                                table,
                                p0,
                              ).constructorMediaRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.mediaId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (circuitMediaRefs)
                        await $_getPrefetchedData<
                          MediaAssetRow,
                          $MediaAssetsTable,
                          CircuitMediaRow
                        >(
                          currentTable: table,
                          referencedTable: $$MediaAssetsTableReferences
                              ._circuitMediaRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$MediaAssetsTableReferences(
                                db,
                                table,
                                p0,
                              ).circuitMediaRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.mediaId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (grandPrixMediaRefs)
                        await $_getPrefetchedData<
                          MediaAssetRow,
                          $MediaAssetsTable,
                          GrandPrixMediaRow
                        >(
                          currentTable: table,
                          referencedTable: $$MediaAssetsTableReferences
                              ._grandPrixMediaRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$MediaAssetsTableReferences(
                                db,
                                table,
                                p0,
                              ).grandPrixMediaRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.mediaId == item.id,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$MediaAssetsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $MediaAssetsTable,
      MediaAssetRow,
      $$MediaAssetsTableFilterComposer,
      $$MediaAssetsTableOrderingComposer,
      $$MediaAssetsTableAnnotationComposer,
      $$MediaAssetsTableCreateCompanionBuilder,
      $$MediaAssetsTableUpdateCompanionBuilder,
      (MediaAssetRow, $$MediaAssetsTableReferences),
      MediaAssetRow,
      PrefetchHooks Function({
        bool mediaAssetVariantsRefs,
        bool driverMediaRefs,
        bool constructorMediaRefs,
        bool circuitMediaRefs,
        bool grandPrixMediaRefs,
      })
    >;
typedef $$MediaAssetVariantsTableCreateCompanionBuilder =
    MediaAssetVariantsCompanion Function({
      required String mediaId,
      required String variantName,
      required String url,
      Value<int?> width,
      Value<int?> height,
      Value<int> rowid,
    });
typedef $$MediaAssetVariantsTableUpdateCompanionBuilder =
    MediaAssetVariantsCompanion Function({
      Value<String> mediaId,
      Value<String> variantName,
      Value<String> url,
      Value<int?> width,
      Value<int?> height,
      Value<int> rowid,
    });

final class $$MediaAssetVariantsTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $MediaAssetVariantsTable,
          MediaVariantRow
        > {
  $$MediaAssetVariantsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $MediaAssetsTable _mediaIdTable(_$GridViewDatabase db) =>
      db.mediaAssets.createAlias('media_variants__media_id__media_assets__id');

  $$MediaAssetsTableProcessedTableManager get mediaId {
    final $_column = $_itemColumn<String>('media_id')!;

    final manager = $$MediaAssetsTableTableManager(
      $_db,
      $_db.mediaAssets,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_mediaIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$MediaAssetVariantsTableFilterComposer
    extends Composer<_$GridViewDatabase, $MediaAssetVariantsTable> {
  $$MediaAssetVariantsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get variantName => $composableBuilder(
    column: $table.variantName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get url => $composableBuilder(
    column: $table.url,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get width => $composableBuilder(
    column: $table.width,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get height => $composableBuilder(
    column: $table.height,
    builder: (column) => ColumnFilters(column),
  );

  $$MediaAssetsTableFilterComposer get mediaId {
    final $$MediaAssetsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableFilterComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$MediaAssetVariantsTableOrderingComposer
    extends Composer<_$GridViewDatabase, $MediaAssetVariantsTable> {
  $$MediaAssetVariantsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get variantName => $composableBuilder(
    column: $table.variantName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get url => $composableBuilder(
    column: $table.url,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get width => $composableBuilder(
    column: $table.width,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get height => $composableBuilder(
    column: $table.height,
    builder: (column) => ColumnOrderings(column),
  );

  $$MediaAssetsTableOrderingComposer get mediaId {
    final $$MediaAssetsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableOrderingComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$MediaAssetVariantsTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $MediaAssetVariantsTable> {
  $$MediaAssetVariantsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get variantName => $composableBuilder(
    column: $table.variantName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get url =>
      $composableBuilder(column: $table.url, builder: (column) => column);

  GeneratedColumn<int> get width =>
      $composableBuilder(column: $table.width, builder: (column) => column);

  GeneratedColumn<int> get height =>
      $composableBuilder(column: $table.height, builder: (column) => column);

  $$MediaAssetsTableAnnotationComposer get mediaId {
    final $$MediaAssetsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableAnnotationComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$MediaAssetVariantsTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $MediaAssetVariantsTable,
          MediaVariantRow,
          $$MediaAssetVariantsTableFilterComposer,
          $$MediaAssetVariantsTableOrderingComposer,
          $$MediaAssetVariantsTableAnnotationComposer,
          $$MediaAssetVariantsTableCreateCompanionBuilder,
          $$MediaAssetVariantsTableUpdateCompanionBuilder,
          (MediaVariantRow, $$MediaAssetVariantsTableReferences),
          MediaVariantRow,
          PrefetchHooks Function({bool mediaId})
        > {
  $$MediaAssetVariantsTableTableManager(
    _$GridViewDatabase db,
    $MediaAssetVariantsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$MediaAssetVariantsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$MediaAssetVariantsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$MediaAssetVariantsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> mediaId = const Value.absent(),
                Value<String> variantName = const Value.absent(),
                Value<String> url = const Value.absent(),
                Value<int?> width = const Value.absent(),
                Value<int?> height = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MediaAssetVariantsCompanion(
                mediaId: mediaId,
                variantName: variantName,
                url: url,
                width: width,
                height: height,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String mediaId,
                required String variantName,
                required String url,
                Value<int?> width = const Value.absent(),
                Value<int?> height = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MediaAssetVariantsCompanion.insert(
                mediaId: mediaId,
                variantName: variantName,
                url: url,
                width: width,
                height: height,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$MediaAssetVariantsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({mediaId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (mediaId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.mediaId,
                                referencedTable:
                                    $$MediaAssetVariantsTableReferences
                                        ._mediaIdTable(db),
                                referencedColumn:
                                    $$MediaAssetVariantsTableReferences
                                        ._mediaIdTable(db)
                                        .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$MediaAssetVariantsTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $MediaAssetVariantsTable,
      MediaVariantRow,
      $$MediaAssetVariantsTableFilterComposer,
      $$MediaAssetVariantsTableOrderingComposer,
      $$MediaAssetVariantsTableAnnotationComposer,
      $$MediaAssetVariantsTableCreateCompanionBuilder,
      $$MediaAssetVariantsTableUpdateCompanionBuilder,
      (MediaVariantRow, $$MediaAssetVariantsTableReferences),
      MediaVariantRow,
      PrefetchHooks Function({bool mediaId})
    >;
typedef $$DriverMediaTableCreateCompanionBuilder =
    DriverMediaCompanion Function({
      required String mediaId,
      required String driverId,
      required int orderIndex,
      Value<int> rowid,
    });
typedef $$DriverMediaTableUpdateCompanionBuilder =
    DriverMediaCompanion Function({
      Value<String> mediaId,
      Value<String> driverId,
      Value<int> orderIndex,
      Value<int> rowid,
    });

final class $$DriverMediaTableReferences
    extends
        BaseReferences<_$GridViewDatabase, $DriverMediaTable, DriverMediaRow> {
  $$DriverMediaTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $MediaAssetsTable _mediaIdTable(_$GridViewDatabase db) =>
      db.mediaAssets.createAlias('driver_media__media_id__media_assets__id');

  $$MediaAssetsTableProcessedTableManager get mediaId {
    final $_column = $_itemColumn<String>('media_id')!;

    final manager = $$MediaAssetsTableTableManager(
      $_db,
      $_db.mediaAssets,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_mediaIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $DriversTable _driverIdTable(_$GridViewDatabase db) =>
      db.drivers.createAlias('driver_media__driver_id__drivers__id');

  $$DriversTableProcessedTableManager get driverId {
    final $_column = $_itemColumn<String>('driver_id')!;

    final manager = $$DriversTableTableManager(
      $_db,
      $_db.drivers,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_driverIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$DriverMediaTableFilterComposer
    extends Composer<_$GridViewDatabase, $DriverMediaTable> {
  $$DriverMediaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnFilters(column),
  );

  $$MediaAssetsTableFilterComposer get mediaId {
    final $$MediaAssetsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableFilterComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableFilterComposer get driverId {
    final $$DriversTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableFilterComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverMediaTableOrderingComposer
    extends Composer<_$GridViewDatabase, $DriverMediaTable> {
  $$DriverMediaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnOrderings(column),
  );

  $$MediaAssetsTableOrderingComposer get mediaId {
    final $$MediaAssetsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableOrderingComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableOrderingComposer get driverId {
    final $$DriversTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableOrderingComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverMediaTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $DriverMediaTable> {
  $$DriverMediaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => column,
  );

  $$MediaAssetsTableAnnotationComposer get mediaId {
    final $$MediaAssetsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableAnnotationComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$DriversTableAnnotationComposer get driverId {
    final $$DriversTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.driverId,
      referencedTable: $db.drivers,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$DriversTableAnnotationComposer(
            $db: $db,
            $table: $db.drivers,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$DriverMediaTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $DriverMediaTable,
          DriverMediaRow,
          $$DriverMediaTableFilterComposer,
          $$DriverMediaTableOrderingComposer,
          $$DriverMediaTableAnnotationComposer,
          $$DriverMediaTableCreateCompanionBuilder,
          $$DriverMediaTableUpdateCompanionBuilder,
          (DriverMediaRow, $$DriverMediaTableReferences),
          DriverMediaRow,
          PrefetchHooks Function({bool mediaId, bool driverId})
        > {
  $$DriverMediaTableTableManager(_$GridViewDatabase db, $DriverMediaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DriverMediaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DriverMediaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DriverMediaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> mediaId = const Value.absent(),
                Value<String> driverId = const Value.absent(),
                Value<int> orderIndex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DriverMediaCompanion(
                mediaId: mediaId,
                driverId: driverId,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String mediaId,
                required String driverId,
                required int orderIndex,
                Value<int> rowid = const Value.absent(),
              }) => DriverMediaCompanion.insert(
                mediaId: mediaId,
                driverId: driverId,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$DriverMediaTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({mediaId = false, driverId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (mediaId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.mediaId,
                                referencedTable: $$DriverMediaTableReferences
                                    ._mediaIdTable(db),
                                referencedColumn: $$DriverMediaTableReferences
                                    ._mediaIdTable(db)
                                    .id,
                              )
                              as T;
                    }
                    if (driverId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.driverId,
                                referencedTable: $$DriverMediaTableReferences
                                    ._driverIdTable(db),
                                referencedColumn: $$DriverMediaTableReferences
                                    ._driverIdTable(db)
                                    .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$DriverMediaTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $DriverMediaTable,
      DriverMediaRow,
      $$DriverMediaTableFilterComposer,
      $$DriverMediaTableOrderingComposer,
      $$DriverMediaTableAnnotationComposer,
      $$DriverMediaTableCreateCompanionBuilder,
      $$DriverMediaTableUpdateCompanionBuilder,
      (DriverMediaRow, $$DriverMediaTableReferences),
      DriverMediaRow,
      PrefetchHooks Function({bool mediaId, bool driverId})
    >;
typedef $$ConstructorMediaTableCreateCompanionBuilder =
    ConstructorMediaCompanion Function({
      required String mediaId,
      required String constructorId,
      required int orderIndex,
      Value<int> rowid,
    });
typedef $$ConstructorMediaTableUpdateCompanionBuilder =
    ConstructorMediaCompanion Function({
      Value<String> mediaId,
      Value<String> constructorId,
      Value<int> orderIndex,
      Value<int> rowid,
    });

final class $$ConstructorMediaTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $ConstructorMediaTable,
          ConstructorMediaRow
        > {
  $$ConstructorMediaTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $MediaAssetsTable _mediaIdTable(_$GridViewDatabase db) => db
      .mediaAssets
      .createAlias('constructor_media__media_id__media_assets__id');

  $$MediaAssetsTableProcessedTableManager get mediaId {
    final $_column = $_itemColumn<String>('media_id')!;

    final manager = $$MediaAssetsTableTableManager(
      $_db,
      $_db.mediaAssets,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_mediaIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $ConstructorsTable _constructorIdTable(_$GridViewDatabase db) => db
      .constructors
      .createAlias('constructor_media__constructor_id__constructors__id');

  $$ConstructorsTableProcessedTableManager get constructorId {
    final $_column = $_itemColumn<String>('constructor_id')!;

    final manager = $$ConstructorsTableTableManager(
      $_db,
      $_db.constructors,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_constructorIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$ConstructorMediaTableFilterComposer
    extends Composer<_$GridViewDatabase, $ConstructorMediaTable> {
  $$ConstructorMediaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnFilters(column),
  );

  $$MediaAssetsTableFilterComposer get mediaId {
    final $$MediaAssetsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableFilterComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableFilterComposer get constructorId {
    final $$ConstructorsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableFilterComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorMediaTableOrderingComposer
    extends Composer<_$GridViewDatabase, $ConstructorMediaTable> {
  $$ConstructorMediaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnOrderings(column),
  );

  $$MediaAssetsTableOrderingComposer get mediaId {
    final $$MediaAssetsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableOrderingComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableOrderingComposer get constructorId {
    final $$ConstructorsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableOrderingComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorMediaTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $ConstructorMediaTable> {
  $$ConstructorMediaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => column,
  );

  $$MediaAssetsTableAnnotationComposer get mediaId {
    final $$MediaAssetsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableAnnotationComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ConstructorsTableAnnotationComposer get constructorId {
    final $$ConstructorsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.constructorId,
      referencedTable: $db.constructors,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ConstructorsTableAnnotationComposer(
            $db: $db,
            $table: $db.constructors,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ConstructorMediaTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $ConstructorMediaTable,
          ConstructorMediaRow,
          $$ConstructorMediaTableFilterComposer,
          $$ConstructorMediaTableOrderingComposer,
          $$ConstructorMediaTableAnnotationComposer,
          $$ConstructorMediaTableCreateCompanionBuilder,
          $$ConstructorMediaTableUpdateCompanionBuilder,
          (ConstructorMediaRow, $$ConstructorMediaTableReferences),
          ConstructorMediaRow,
          PrefetchHooks Function({bool mediaId, bool constructorId})
        > {
  $$ConstructorMediaTableTableManager(
    _$GridViewDatabase db,
    $ConstructorMediaTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ConstructorMediaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ConstructorMediaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ConstructorMediaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> mediaId = const Value.absent(),
                Value<String> constructorId = const Value.absent(),
                Value<int> orderIndex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ConstructorMediaCompanion(
                mediaId: mediaId,
                constructorId: constructorId,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String mediaId,
                required String constructorId,
                required int orderIndex,
                Value<int> rowid = const Value.absent(),
              }) => ConstructorMediaCompanion.insert(
                mediaId: mediaId,
                constructorId: constructorId,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$ConstructorMediaTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({mediaId = false, constructorId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (mediaId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.mediaId,
                                referencedTable:
                                    $$ConstructorMediaTableReferences
                                        ._mediaIdTable(db),
                                referencedColumn:
                                    $$ConstructorMediaTableReferences
                                        ._mediaIdTable(db)
                                        .id,
                              )
                              as T;
                    }
                    if (constructorId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.constructorId,
                                referencedTable:
                                    $$ConstructorMediaTableReferences
                                        ._constructorIdTable(db),
                                referencedColumn:
                                    $$ConstructorMediaTableReferences
                                        ._constructorIdTable(db)
                                        .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$ConstructorMediaTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $ConstructorMediaTable,
      ConstructorMediaRow,
      $$ConstructorMediaTableFilterComposer,
      $$ConstructorMediaTableOrderingComposer,
      $$ConstructorMediaTableAnnotationComposer,
      $$ConstructorMediaTableCreateCompanionBuilder,
      $$ConstructorMediaTableUpdateCompanionBuilder,
      (ConstructorMediaRow, $$ConstructorMediaTableReferences),
      ConstructorMediaRow,
      PrefetchHooks Function({bool mediaId, bool constructorId})
    >;
typedef $$CircuitMediaTableCreateCompanionBuilder =
    CircuitMediaCompanion Function({
      required String mediaId,
      required String circuitId,
      required int orderIndex,
      Value<int> rowid,
    });
typedef $$CircuitMediaTableUpdateCompanionBuilder =
    CircuitMediaCompanion Function({
      Value<String> mediaId,
      Value<String> circuitId,
      Value<int> orderIndex,
      Value<int> rowid,
    });

final class $$CircuitMediaTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $CircuitMediaTable,
          CircuitMediaRow
        > {
  $$CircuitMediaTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $MediaAssetsTable _mediaIdTable(_$GridViewDatabase db) =>
      db.mediaAssets.createAlias('circuit_media__media_id__media_assets__id');

  $$MediaAssetsTableProcessedTableManager get mediaId {
    final $_column = $_itemColumn<String>('media_id')!;

    final manager = $$MediaAssetsTableTableManager(
      $_db,
      $_db.mediaAssets,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_mediaIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $CircuitsTable _circuitIdTable(_$GridViewDatabase db) =>
      db.circuits.createAlias('circuit_media__circuit_id__circuits__id');

  $$CircuitsTableProcessedTableManager get circuitId {
    final $_column = $_itemColumn<String>('circuit_id')!;

    final manager = $$CircuitsTableTableManager(
      $_db,
      $_db.circuits,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_circuitIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$CircuitMediaTableFilterComposer
    extends Composer<_$GridViewDatabase, $CircuitMediaTable> {
  $$CircuitMediaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnFilters(column),
  );

  $$MediaAssetsTableFilterComposer get mediaId {
    final $$MediaAssetsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableFilterComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$CircuitsTableFilterComposer get circuitId {
    final $$CircuitsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.circuitId,
      referencedTable: $db.circuits,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitsTableFilterComposer(
            $db: $db,
            $table: $db.circuits,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$CircuitMediaTableOrderingComposer
    extends Composer<_$GridViewDatabase, $CircuitMediaTable> {
  $$CircuitMediaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnOrderings(column),
  );

  $$MediaAssetsTableOrderingComposer get mediaId {
    final $$MediaAssetsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableOrderingComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$CircuitsTableOrderingComposer get circuitId {
    final $$CircuitsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.circuitId,
      referencedTable: $db.circuits,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitsTableOrderingComposer(
            $db: $db,
            $table: $db.circuits,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$CircuitMediaTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $CircuitMediaTable> {
  $$CircuitMediaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => column,
  );

  $$MediaAssetsTableAnnotationComposer get mediaId {
    final $$MediaAssetsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableAnnotationComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$CircuitsTableAnnotationComposer get circuitId {
    final $$CircuitsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.circuitId,
      referencedTable: $db.circuits,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CircuitsTableAnnotationComposer(
            $db: $db,
            $table: $db.circuits,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$CircuitMediaTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $CircuitMediaTable,
          CircuitMediaRow,
          $$CircuitMediaTableFilterComposer,
          $$CircuitMediaTableOrderingComposer,
          $$CircuitMediaTableAnnotationComposer,
          $$CircuitMediaTableCreateCompanionBuilder,
          $$CircuitMediaTableUpdateCompanionBuilder,
          (CircuitMediaRow, $$CircuitMediaTableReferences),
          CircuitMediaRow,
          PrefetchHooks Function({bool mediaId, bool circuitId})
        > {
  $$CircuitMediaTableTableManager(
    _$GridViewDatabase db,
    $CircuitMediaTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CircuitMediaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CircuitMediaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CircuitMediaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> mediaId = const Value.absent(),
                Value<String> circuitId = const Value.absent(),
                Value<int> orderIndex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CircuitMediaCompanion(
                mediaId: mediaId,
                circuitId: circuitId,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String mediaId,
                required String circuitId,
                required int orderIndex,
                Value<int> rowid = const Value.absent(),
              }) => CircuitMediaCompanion.insert(
                mediaId: mediaId,
                circuitId: circuitId,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$CircuitMediaTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({mediaId = false, circuitId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (mediaId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.mediaId,
                                referencedTable: $$CircuitMediaTableReferences
                                    ._mediaIdTable(db),
                                referencedColumn: $$CircuitMediaTableReferences
                                    ._mediaIdTable(db)
                                    .id,
                              )
                              as T;
                    }
                    if (circuitId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.circuitId,
                                referencedTable: $$CircuitMediaTableReferences
                                    ._circuitIdTable(db),
                                referencedColumn: $$CircuitMediaTableReferences
                                    ._circuitIdTable(db)
                                    .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$CircuitMediaTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $CircuitMediaTable,
      CircuitMediaRow,
      $$CircuitMediaTableFilterComposer,
      $$CircuitMediaTableOrderingComposer,
      $$CircuitMediaTableAnnotationComposer,
      $$CircuitMediaTableCreateCompanionBuilder,
      $$CircuitMediaTableUpdateCompanionBuilder,
      (CircuitMediaRow, $$CircuitMediaTableReferences),
      CircuitMediaRow,
      PrefetchHooks Function({bool mediaId, bool circuitId})
    >;
typedef $$GrandPrixMediaTableCreateCompanionBuilder =
    GrandPrixMediaCompanion Function({
      required String mediaId,
      required String grandPrixId,
      required int orderIndex,
      Value<int> rowid,
    });
typedef $$GrandPrixMediaTableUpdateCompanionBuilder =
    GrandPrixMediaCompanion Function({
      Value<String> mediaId,
      Value<String> grandPrixId,
      Value<int> orderIndex,
      Value<int> rowid,
    });

final class $$GrandPrixMediaTableReferences
    extends
        BaseReferences<
          _$GridViewDatabase,
          $GrandPrixMediaTable,
          GrandPrixMediaRow
        > {
  $$GrandPrixMediaTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $MediaAssetsTable _mediaIdTable(_$GridViewDatabase db) => db
      .mediaAssets
      .createAlias('grand_prix_media__media_id__media_assets__id');

  $$MediaAssetsTableProcessedTableManager get mediaId {
    final $_column = $_itemColumn<String>('media_id')!;

    final manager = $$MediaAssetsTableTableManager(
      $_db,
      $_db.mediaAssets,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_mediaIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $GrandPrixEventsTable _grandPrixIdTable(_$GridViewDatabase db) => db
      .grandPrixEvents
      .createAlias('grand_prix_media__grand_prix_id__grand_prix__id');

  $$GrandPrixEventsTableProcessedTableManager get grandPrixId {
    final $_column = $_itemColumn<String>('grand_prix_id')!;

    final manager = $$GrandPrixEventsTableTableManager(
      $_db,
      $_db.grandPrixEvents,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_grandPrixIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$GrandPrixMediaTableFilterComposer
    extends Composer<_$GridViewDatabase, $GrandPrixMediaTable> {
  $$GrandPrixMediaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnFilters(column),
  );

  $$MediaAssetsTableFilterComposer get mediaId {
    final $$MediaAssetsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableFilterComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$GrandPrixEventsTableFilterComposer get grandPrixId {
    final $$GrandPrixEventsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableFilterComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$GrandPrixMediaTableOrderingComposer
    extends Composer<_$GridViewDatabase, $GrandPrixMediaTable> {
  $$GrandPrixMediaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => ColumnOrderings(column),
  );

  $$MediaAssetsTableOrderingComposer get mediaId {
    final $$MediaAssetsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableOrderingComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$GrandPrixEventsTableOrderingComposer get grandPrixId {
    final $$GrandPrixEventsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableOrderingComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$GrandPrixMediaTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $GrandPrixMediaTable> {
  $$GrandPrixMediaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get orderIndex => $composableBuilder(
    column: $table.orderIndex,
    builder: (column) => column,
  );

  $$MediaAssetsTableAnnotationComposer get mediaId {
    final $$MediaAssetsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.mediaId,
      referencedTable: $db.mediaAssets,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$MediaAssetsTableAnnotationComposer(
            $db: $db,
            $table: $db.mediaAssets,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$GrandPrixEventsTableAnnotationComposer get grandPrixId {
    final $$GrandPrixEventsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.grandPrixId,
      referencedTable: $db.grandPrixEvents,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$GrandPrixEventsTableAnnotationComposer(
            $db: $db,
            $table: $db.grandPrixEvents,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$GrandPrixMediaTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $GrandPrixMediaTable,
          GrandPrixMediaRow,
          $$GrandPrixMediaTableFilterComposer,
          $$GrandPrixMediaTableOrderingComposer,
          $$GrandPrixMediaTableAnnotationComposer,
          $$GrandPrixMediaTableCreateCompanionBuilder,
          $$GrandPrixMediaTableUpdateCompanionBuilder,
          (GrandPrixMediaRow, $$GrandPrixMediaTableReferences),
          GrandPrixMediaRow,
          PrefetchHooks Function({bool mediaId, bool grandPrixId})
        > {
  $$GrandPrixMediaTableTableManager(
    _$GridViewDatabase db,
    $GrandPrixMediaTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$GrandPrixMediaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$GrandPrixMediaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$GrandPrixMediaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> mediaId = const Value.absent(),
                Value<String> grandPrixId = const Value.absent(),
                Value<int> orderIndex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => GrandPrixMediaCompanion(
                mediaId: mediaId,
                grandPrixId: grandPrixId,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String mediaId,
                required String grandPrixId,
                required int orderIndex,
                Value<int> rowid = const Value.absent(),
              }) => GrandPrixMediaCompanion.insert(
                mediaId: mediaId,
                grandPrixId: grandPrixId,
                orderIndex: orderIndex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$GrandPrixMediaTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({mediaId = false, grandPrixId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (mediaId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.mediaId,
                                referencedTable: $$GrandPrixMediaTableReferences
                                    ._mediaIdTable(db),
                                referencedColumn:
                                    $$GrandPrixMediaTableReferences
                                        ._mediaIdTable(db)
                                        .id,
                              )
                              as T;
                    }
                    if (grandPrixId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.grandPrixId,
                                referencedTable: $$GrandPrixMediaTableReferences
                                    ._grandPrixIdTable(db),
                                referencedColumn:
                                    $$GrandPrixMediaTableReferences
                                        ._grandPrixIdTable(db)
                                        .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$GrandPrixMediaTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $GrandPrixMediaTable,
      GrandPrixMediaRow,
      $$GrandPrixMediaTableFilterComposer,
      $$GrandPrixMediaTableOrderingComposer,
      $$GrandPrixMediaTableAnnotationComposer,
      $$GrandPrixMediaTableCreateCompanionBuilder,
      $$GrandPrixMediaTableUpdateCompanionBuilder,
      (GrandPrixMediaRow, $$GrandPrixMediaTableReferences),
      GrandPrixMediaRow,
      PrefetchHooks Function({bool mediaId, bool grandPrixId})
    >;
typedef $$ResourceSyncMetadataTableCreateCompanionBuilder =
    ResourceSyncMetadataCompanion Function({
      required String resourceKey,
      Value<int?> season,
      Value<String?> entityId,
      Value<int?> round,
      Value<String?> etag,
      Value<DateTime?> generatedAt,
      Value<DateTime?> sourceUpdatedAt,
      Value<DateTime?> staleAfter,
      Value<String?> contentVersion,
      Value<DateTime?> lastAttemptAt,
      Value<DateTime?> lastSuccessAt,
      Value<String?> lastFailureCategory,
      Value<bool?> serverStale,
      Value<int> rowid,
    });
typedef $$ResourceSyncMetadataTableUpdateCompanionBuilder =
    ResourceSyncMetadataCompanion Function({
      Value<String> resourceKey,
      Value<int?> season,
      Value<String?> entityId,
      Value<int?> round,
      Value<String?> etag,
      Value<DateTime?> generatedAt,
      Value<DateTime?> sourceUpdatedAt,
      Value<DateTime?> staleAfter,
      Value<String?> contentVersion,
      Value<DateTime?> lastAttemptAt,
      Value<DateTime?> lastSuccessAt,
      Value<String?> lastFailureCategory,
      Value<bool?> serverStale,
      Value<int> rowid,
    });

class $$ResourceSyncMetadataTableFilterComposer
    extends Composer<_$GridViewDatabase, $ResourceSyncMetadataTable> {
  $$ResourceSyncMetadataTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get resourceKey => $composableBuilder(
    column: $table.resourceKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get season => $composableBuilder(
    column: $table.season,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get round => $composableBuilder(
    column: $table.round,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get etag => $composableBuilder(
    column: $table.etag,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get generatedAt => $composableBuilder(
    column: $table.generatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get sourceUpdatedAt => $composableBuilder(
    column: $table.sourceUpdatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get staleAfter => $composableBuilder(
    column: $table.staleAfter,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get contentVersion => $composableBuilder(
    column: $table.contentVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get lastAttemptAt => $composableBuilder(
    column: $table.lastAttemptAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get lastSuccessAt => $composableBuilder(
    column: $table.lastSuccessAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastFailureCategory => $composableBuilder(
    column: $table.lastFailureCategory,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get serverStale => $composableBuilder(
    column: $table.serverStale,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ResourceSyncMetadataTableOrderingComposer
    extends Composer<_$GridViewDatabase, $ResourceSyncMetadataTable> {
  $$ResourceSyncMetadataTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get resourceKey => $composableBuilder(
    column: $table.resourceKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get season => $composableBuilder(
    column: $table.season,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get round => $composableBuilder(
    column: $table.round,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get etag => $composableBuilder(
    column: $table.etag,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get generatedAt => $composableBuilder(
    column: $table.generatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get sourceUpdatedAt => $composableBuilder(
    column: $table.sourceUpdatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get staleAfter => $composableBuilder(
    column: $table.staleAfter,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get contentVersion => $composableBuilder(
    column: $table.contentVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get lastAttemptAt => $composableBuilder(
    column: $table.lastAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get lastSuccessAt => $composableBuilder(
    column: $table.lastSuccessAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastFailureCategory => $composableBuilder(
    column: $table.lastFailureCategory,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get serverStale => $composableBuilder(
    column: $table.serverStale,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ResourceSyncMetadataTableAnnotationComposer
    extends Composer<_$GridViewDatabase, $ResourceSyncMetadataTable> {
  $$ResourceSyncMetadataTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get resourceKey => $composableBuilder(
    column: $table.resourceKey,
    builder: (column) => column,
  );

  GeneratedColumn<int> get season =>
      $composableBuilder(column: $table.season, builder: (column) => column);

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<int> get round =>
      $composableBuilder(column: $table.round, builder: (column) => column);

  GeneratedColumn<String> get etag =>
      $composableBuilder(column: $table.etag, builder: (column) => column);

  GeneratedColumn<DateTime> get generatedAt => $composableBuilder(
    column: $table.generatedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get sourceUpdatedAt => $composableBuilder(
    column: $table.sourceUpdatedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get staleAfter => $composableBuilder(
    column: $table.staleAfter,
    builder: (column) => column,
  );

  GeneratedColumn<String> get contentVersion => $composableBuilder(
    column: $table.contentVersion,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get lastAttemptAt => $composableBuilder(
    column: $table.lastAttemptAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get lastSuccessAt => $composableBuilder(
    column: $table.lastSuccessAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastFailureCategory => $composableBuilder(
    column: $table.lastFailureCategory,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get serverStale => $composableBuilder(
    column: $table.serverStale,
    builder: (column) => column,
  );
}

class $$ResourceSyncMetadataTableTableManager
    extends
        RootTableManager<
          _$GridViewDatabase,
          $ResourceSyncMetadataTable,
          ResourceSyncMetadataRow,
          $$ResourceSyncMetadataTableFilterComposer,
          $$ResourceSyncMetadataTableOrderingComposer,
          $$ResourceSyncMetadataTableAnnotationComposer,
          $$ResourceSyncMetadataTableCreateCompanionBuilder,
          $$ResourceSyncMetadataTableUpdateCompanionBuilder,
          (
            ResourceSyncMetadataRow,
            BaseReferences<
              _$GridViewDatabase,
              $ResourceSyncMetadataTable,
              ResourceSyncMetadataRow
            >,
          ),
          ResourceSyncMetadataRow,
          PrefetchHooks Function()
        > {
  $$ResourceSyncMetadataTableTableManager(
    _$GridViewDatabase db,
    $ResourceSyncMetadataTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ResourceSyncMetadataTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ResourceSyncMetadataTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$ResourceSyncMetadataTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> resourceKey = const Value.absent(),
                Value<int?> season = const Value.absent(),
                Value<String?> entityId = const Value.absent(),
                Value<int?> round = const Value.absent(),
                Value<String?> etag = const Value.absent(),
                Value<DateTime?> generatedAt = const Value.absent(),
                Value<DateTime?> sourceUpdatedAt = const Value.absent(),
                Value<DateTime?> staleAfter = const Value.absent(),
                Value<String?> contentVersion = const Value.absent(),
                Value<DateTime?> lastAttemptAt = const Value.absent(),
                Value<DateTime?> lastSuccessAt = const Value.absent(),
                Value<String?> lastFailureCategory = const Value.absent(),
                Value<bool?> serverStale = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ResourceSyncMetadataCompanion(
                resourceKey: resourceKey,
                season: season,
                entityId: entityId,
                round: round,
                etag: etag,
                generatedAt: generatedAt,
                sourceUpdatedAt: sourceUpdatedAt,
                staleAfter: staleAfter,
                contentVersion: contentVersion,
                lastAttemptAt: lastAttemptAt,
                lastSuccessAt: lastSuccessAt,
                lastFailureCategory: lastFailureCategory,
                serverStale: serverStale,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String resourceKey,
                Value<int?> season = const Value.absent(),
                Value<String?> entityId = const Value.absent(),
                Value<int?> round = const Value.absent(),
                Value<String?> etag = const Value.absent(),
                Value<DateTime?> generatedAt = const Value.absent(),
                Value<DateTime?> sourceUpdatedAt = const Value.absent(),
                Value<DateTime?> staleAfter = const Value.absent(),
                Value<String?> contentVersion = const Value.absent(),
                Value<DateTime?> lastAttemptAt = const Value.absent(),
                Value<DateTime?> lastSuccessAt = const Value.absent(),
                Value<String?> lastFailureCategory = const Value.absent(),
                Value<bool?> serverStale = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ResourceSyncMetadataCompanion.insert(
                resourceKey: resourceKey,
                season: season,
                entityId: entityId,
                round: round,
                etag: etag,
                generatedAt: generatedAt,
                sourceUpdatedAt: sourceUpdatedAt,
                staleAfter: staleAfter,
                contentVersion: contentVersion,
                lastAttemptAt: lastAttemptAt,
                lastSuccessAt: lastSuccessAt,
                lastFailureCategory: lastFailureCategory,
                serverStale: serverStale,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ResourceSyncMetadataTableProcessedTableManager =
    ProcessedTableManager<
      _$GridViewDatabase,
      $ResourceSyncMetadataTable,
      ResourceSyncMetadataRow,
      $$ResourceSyncMetadataTableFilterComposer,
      $$ResourceSyncMetadataTableOrderingComposer,
      $$ResourceSyncMetadataTableAnnotationComposer,
      $$ResourceSyncMetadataTableCreateCompanionBuilder,
      $$ResourceSyncMetadataTableUpdateCompanionBuilder,
      (
        ResourceSyncMetadataRow,
        BaseReferences<
          _$GridViewDatabase,
          $ResourceSyncMetadataTable,
          ResourceSyncMetadataRow
        >,
      ),
      ResourceSyncMetadataRow,
      PrefetchHooks Function()
    >;

class $GridViewDatabaseManager {
  final _$GridViewDatabase _db;
  $GridViewDatabaseManager(this._db);
  $$SeasonsTableTableManager get seasons =>
      $$SeasonsTableTableManager(_db, _db.seasons);
  $$CircuitsTableTableManager get circuits =>
      $$CircuitsTableTableManager(_db, _db.circuits);
  $$GrandPrixEventsTableTableManager get grandPrixEvents =>
      $$GrandPrixEventsTableTableManager(_db, _db.grandPrixEvents);
  $$SessionsTableTableManager get sessions =>
      $$SessionsTableTableManager(_db, _db.sessions);
  $$SnapshotsTableTableManager get snapshots =>
      $$SnapshotsTableTableManager(_db, _db.snapshots);
  $$DriversTableTableManager get drivers =>
      $$DriversTableTableManager(_db, _db.drivers);
  $$ConstructorsTableTableManager get constructors =>
      $$ConstructorsTableTableManager(_db, _db.constructors);
  $$DriverSeasonEntriesTableTableManager get driverSeasonEntries =>
      $$DriverSeasonEntriesTableTableManager(_db, _db.driverSeasonEntries);
  $$ConstructorSeasonEntriesTableTableManager get constructorSeasonEntries =>
      $$ConstructorSeasonEntriesTableTableManager(
        _db,
        _db.constructorSeasonEntries,
      );
  $$DriverStandingsTableTableManager get driverStandings =>
      $$DriverStandingsTableTableManager(_db, _db.driverStandings);
  $$ConstructorStandingsTableTableManager get constructorStandings =>
      $$ConstructorStandingsTableTableManager(_db, _db.constructorStandings);
  $$RaceResultsTableTableManager get raceResults =>
      $$RaceResultsTableTableManager(_db, _db.raceResults);
  $$RaceResultEntriesTableTableManager get raceResultEntries =>
      $$RaceResultEntriesTableTableManager(_db, _db.raceResultEntries);
  $$MediaAssetsTableTableManager get mediaAssets =>
      $$MediaAssetsTableTableManager(_db, _db.mediaAssets);
  $$MediaAssetVariantsTableTableManager get mediaAssetVariants =>
      $$MediaAssetVariantsTableTableManager(_db, _db.mediaAssetVariants);
  $$DriverMediaTableTableManager get driverMedia =>
      $$DriverMediaTableTableManager(_db, _db.driverMedia);
  $$ConstructorMediaTableTableManager get constructorMedia =>
      $$ConstructorMediaTableTableManager(_db, _db.constructorMedia);
  $$CircuitMediaTableTableManager get circuitMedia =>
      $$CircuitMediaTableTableManager(_db, _db.circuitMedia);
  $$GrandPrixMediaTableTableManager get grandPrixMedia =>
      $$GrandPrixMediaTableTableManager(_db, _db.grandPrixMedia);
  $$ResourceSyncMetadataTableTableManager get resourceSyncMetadata =>
      $$ResourceSyncMetadataTableTableManager(_db, _db.resourceSyncMetadata);
}
