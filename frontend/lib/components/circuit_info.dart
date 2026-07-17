import 'package:flutter/material.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/models/circuit.dart';
import 'package:gridview/utils/constants.dart';

class CircuitInfo extends StatelessWidget {
  final Circuit circuit;

  const CircuitInfo({
    super.key,
    required this.circuit,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
            Colors.red.withAlpha((0.8 * 255).toInt()),
            Colors.red,
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Circuit Information Section
            _buildInfoRow(context, Icons.flag, AppLocalizations.of(context)!.firstGP, circuit.startYear.toString()),
            _buildInfoRow(context, Icons.timeline, AppLocalizations.of(context)!.circuitLength, '${circuit.length} m'),
            _buildInfoRow(context, Icons.sync_alt, AppLocalizations.of(context)!.laps, circuit.laps.toString()),
            _buildInfoRow(context, Icons.directions, AppLocalizations.of(context)!.raceDistance, '${circuit.raceDistance} m'),
            _buildLapRecordSection(context),
            _buildInfoRow(context, Icons.replay, AppLocalizations.of(context)!.turns, circuit.turns.toString()),
            _buildInfoRow(context, Icons.speed, AppLocalizations.of(context)!.drsZones, circuit.drsZones.toString()),
            _buildInfoRow(context, Icons.event, AppLocalizations.of(context)!.contractExpiry, circuit.yearContract.toString()),
            const SizedBox(height: 15),
            // Circuit Layout Image
            _buildCircuitImage(context),
            const SizedBox(height: 15),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(BuildContext context, IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.white70),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white, fontSize: 16),
            ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _buildLapRecordSection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildInfoRow(
            context,
            Icons.timer,
            AppLocalizations.of(context)!.lapRecord,
            circuit.lapRecord,
          ),
          Row(
            children: [
              Spacer(),
              Text(
                '${circuit.driverLapRecord} (${circuit.yearLapRecord})',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.white70, fontSize: 15),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCircuitImage(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Image.asset(
          '$layoutsPath${circuit.layoutImagePath}',
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => Container(
            color: Colors.grey.shade200,
            child: const Center(
              child: Icon(Icons.error, color: Colors.red, size: 40),
            ),
          ),
        ),
      ),
    );
  }
}