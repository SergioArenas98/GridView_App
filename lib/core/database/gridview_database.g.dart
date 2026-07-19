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
  @override
  List<GeneratedColumn> get $columns => [
    id,
    name,
    locality,
    country,
    countryCode,
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
  const CircuitRow({
    required this.id,
    required this.name,
    this.locality,
    this.country,
    this.countryCode,
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
    };
  }

  CircuitRow copyWith({
    String? id,
    String? name,
    Value<String?> locality = const Value.absent(),
    Value<String?> country = const Value.absent(),
    Value<String?> countryCode = const Value.absent(),
  }) => CircuitRow(
    id: id ?? this.id,
    name: name ?? this.name,
    locality: locality.present ? locality.value : this.locality,
    country: country.present ? country.value : this.country,
    countryCode: countryCode.present ? countryCode.value : this.countryCode,
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
    );
  }

  @override
  String toString() {
    return (StringBuffer('CircuitRow(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('locality: $locality, ')
          ..write('country: $country, ')
          ..write('countryCode: $countryCode')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, name, locality, country, countryCode);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CircuitRow &&
          other.id == this.id &&
          other.name == this.name &&
          other.locality == this.locality &&
          other.country == this.country &&
          other.countryCode == this.countryCode);
}

class CircuitsCompanion extends UpdateCompanion<CircuitRow> {
  final Value<String> id;
  final Value<String> name;
  final Value<String?> locality;
  final Value<String?> country;
  final Value<String?> countryCode;
  final Value<int> rowid;
  const CircuitsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.locality = const Value.absent(),
    this.country = const Value.absent(),
    this.countryCode = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CircuitsCompanion.insert({
    required String id,
    required String name,
    this.locality = const Value.absent(),
    this.country = const Value.absent(),
    this.countryCode = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       name = Value(name);
  static Insertable<CircuitRow> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<String>? locality,
    Expression<String>? country,
    Expression<String>? countryCode,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (locality != null) 'locality': locality,
      if (country != null) 'country': country,
      if (countryCode != null) 'country_code': countryCode,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CircuitsCompanion copyWith({
    Value<String>? id,
    Value<String>? name,
    Value<String?>? locality,
    Value<String?>? country,
    Value<String?>? countryCode,
    Value<int>? rowid,
  }) {
    return CircuitsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      locality: locality ?? this.locality,
      country: country ?? this.country,
      countryCode: countryCode ?? this.countryCode,
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
  late final VerticalSliceDao verticalSliceDao = VerticalSliceDao(
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
  ]);
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
          PrefetchHooks Function({bool grandPrixEventsRefs})
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
          prefetchHooksCallback: ({grandPrixEventsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [
                if (grandPrixEventsRefs) db.grandPrixEvents,
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
                      managerFromTypedResult: (p0) => $$SeasonsTableReferences(
                        db,
                        table,
                        p0,
                      ).grandPrixEventsRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.season == item.year),
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
      PrefetchHooks Function({bool grandPrixEventsRefs})
    >;
typedef $$CircuitsTableCreateCompanionBuilder =
    CircuitsCompanion Function({
      required String id,
      required String name,
      Value<String?> locality,
      Value<String?> country,
      Value<String?> countryCode,
      Value<int> rowid,
    });
typedef $$CircuitsTableUpdateCompanionBuilder =
    CircuitsCompanion Function({
      Value<String> id,
      Value<String> name,
      Value<String?> locality,
      Value<String?> country,
      Value<String?> countryCode,
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
          PrefetchHooks Function({bool grandPrixEventsRefs})
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
                Value<int> rowid = const Value.absent(),
              }) => CircuitsCompanion(
                id: id,
                name: name,
                locality: locality,
                country: country,
                countryCode: countryCode,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String name,
                Value<String?> locality = const Value.absent(),
                Value<String?> country = const Value.absent(),
                Value<String?> countryCode = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CircuitsCompanion.insert(
                id: id,
                name: name,
                locality: locality,
                country: country,
                countryCode: countryCode,
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
          prefetchHooksCallback: ({grandPrixEventsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [
                if (grandPrixEventsRefs) db.grandPrixEvents,
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
                      managerFromTypedResult: (p0) => $$CircuitsTableReferences(
                        db,
                        table,
                        p0,
                      ).grandPrixEventsRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.circuitId == item.id),
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
      PrefetchHooks Function({bool grandPrixEventsRefs})
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
              ({season = false, circuitId = false, sessionsRefs = false}) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [if (sessionsRefs) db.sessions],
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
      PrefetchHooks Function({bool season, bool circuitId, bool sessionsRefs})
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
}
