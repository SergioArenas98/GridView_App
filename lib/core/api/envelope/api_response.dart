import 'meta_dto.dart';

/// A parsed success envelope: the decoded `data` payload plus its metadata.
/// `data` parsing is supplied by the caller so the same envelope works for any
/// entity or collection.
class ApiResponse<T> {
  const ApiResponse({required this.data, required this.meta});

  final T data;
  final MetaDto meta;

  static ApiResponse<T> parse<T>(
    Map<String, dynamic> json,
    T Function(Object? data) dataFromJson,
  ) {
    return ApiResponse<T>(
      data: dataFromJson(json['data']),
      meta: MetaDto.fromJson(json['meta'] as Map<String, dynamic>),
    );
  }
}
