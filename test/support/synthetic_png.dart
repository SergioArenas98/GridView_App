import 'dart:io';
import 'dart:typed_data';

/// A minimal, deterministic PNG encoder for test imagery.
///
/// GridView has no approved Formula 1 media, so every image any test or golden
/// renders is **generated here**: flat geometric bands, unmistakably synthetic.
/// Nothing in the test suite is a driver photograph, a team logo, a Formula 1
/// mark, circuit photography, a screenshot or a provider URL.
///
/// Written by hand rather than pulled from an image package because the output
/// has to be byte-identical every run for a golden to be stable, and because a
/// test dependency that decodes arbitrary images is a larger surface than
/// writing forty lines of PNG.

/// A solid-colour PNG of [width] x [height].
Uint8List solidPng(int width, int height, int r, int g, int b) =>
    _encodePng(width, height, (int x, int y) => <int>[r, g, b]);

/// A PNG with horizontal bands, so a scaled or cropped render is visibly
/// different from an unscaled one.
Uint8List bandedPng(int width, int height, {int bands = 4}) {
  final int bandHeight = (height / bands).ceil().clamp(1, height);
  return _encodePng(width, height, (int x, int y) {
    final int index = y ~/ bandHeight;
    final int shade = ((index + 1) * 60) % 256;
    return <int>[shade, (255 - shade), 128];
  });
}

/// Writes [bytes] to a uniquely named file in [directory] and returns it.
File writePng(Directory directory, String name, Uint8List bytes) {
  final File file = File('${directory.path}${Platform.pathSeparator}$name');
  file.writeAsBytesSync(bytes);
  return file;
}

Uint8List _encodePng(
  int width,
  int height,
  List<int> Function(int x, int y) pixel,
) {
  // Raw scanlines: one filter byte (0 = none) followed by RGB triples.
  final BytesBuilder raw = BytesBuilder();
  for (int y = 0; y < height; y++) {
    raw.addByte(0);
    for (int x = 0; x < width; x++) {
      raw.add(pixel(x, y));
    }
  }
  final List<int> compressed = ZLibEncoder(level: 9).convert(raw.toBytes());

  final BytesBuilder out = BytesBuilder()
    ..add(<int>[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  out.add(
    _chunk('IHDR', <int>[
      ..._be32(width),
      ..._be32(height),
      8, // bit depth
      2, // colour type: truecolour
      0, 0, 0, // compression, filter, interlace
    ]),
  );
  out.add(_chunk('IDAT', compressed));
  out.add(_chunk('IEND', const <int>[]));
  return out.toBytes();
}

List<int> _chunk(String type, List<int> data) {
  final List<int> typeBytes = type.codeUnits;
  final List<int> body = <int>[...typeBytes, ...data];
  return <int>[..._be32(data.length), ...body, ..._be32(_crc32(body))];
}

List<int> _be32(int value) => <int>[
  (value >> 24) & 0xFF,
  (value >> 16) & 0xFF,
  (value >> 8) & 0xFF,
  value & 0xFF,
];

final List<int> _crcTable = List<int>.generate(256, (int n) {
  int c = n;
  for (int k = 0; k < 8; k++) {
    c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1;
  }
  return c;
});

int _crc32(List<int> bytes) {
  int c = 0xFFFFFFFF;
  for (final int byte in bytes) {
    c = _crcTable[(c ^ byte) & 0xFF] ^ (c >> 8);
  }
  return (c ^ 0xFFFFFFFF) & 0xFFFFFFFF;
}
