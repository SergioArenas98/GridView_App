import 'package:flutter/material.dart';

/// GridView top app bar. Data-agnostic: takes a title string and optional
/// leading/action slots. Styling comes from the theme.
class GvAppBar extends StatelessWidget implements PreferredSizeWidget {
  const GvAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.automaticallyImplyLeading = true,
  });

  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool automaticallyImplyLeading;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      leading: leading,
      actions: actions,
      automaticallyImplyLeading: automaticallyImplyLeading,
    );
  }
}
