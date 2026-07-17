import 'package:flutter/material.dart';
import 'package:gridview/utils/constants.dart';

class SettingsButton extends StatelessWidget {
  final String iconPath;
  final String text;
  final VoidCallback onTap;
  final Widget? trailing;
  final double height;
  final double borderRadius;

  const SettingsButton({
    super.key,
    required this.iconPath,
    required this.text,
    required this.onTap,
    this.trailing,
    this.height = 75,
    this.borderRadius = 2,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Colors.red,
              Colors.red.withAlpha((0.7 * 255).toInt()),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(borderRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha((0.2 * 255).toInt()),
              blurRadius: 8,
              spreadRadius: 5,
              offset: const Offset(0, 4),
            ),
          ],
        ),
      margin: const EdgeInsets.symmetric(horizontal: 15, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Image.asset(
                  iconPath,
                  fit: BoxFit.cover,
                  width: 30,
                  height: 30,
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 20),
                  child: Text(
                    text,
                    style: mainText.copyWith(color: Colors.black, fontSize: 15)
                  ),
                ),
              ],
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}