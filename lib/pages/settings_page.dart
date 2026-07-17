import 'package:gridview/components/settings_button.dart';
import 'package:gridview/components/updates_dialog.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/services/language_provider.dart';
import 'package:gridview/themes/theme_provider.dart';
import 'package:gridview/utils/constants.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  SettingsPageState createState() => SettingsPageState();
}

class SettingsPageState extends State<SettingsPage> {

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _launchUrl(String url, BuildContext context) async {
    final currentContext = context;
    if (!currentContext.mounted) return;

    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        if (!currentContext.mounted) return;
        ScaffoldMessenger.of(currentContext).showSnackBar(
          const SnackBar(content: Text('No se pudo abrir el enlace')),
        );
      }
    } catch (e) {
      if (!currentContext.mounted) return;
      ScaffoldMessenger.of(currentContext).showSnackBar(
        const SnackBar(content: Text('Ocurrió un error')),
      );
    }
  }

  void _sendFeedback(String message, BuildContext context) async {
    final emailUrl = Uri(
      scheme: 'mailto',
      path: 'gridviewapp1@gmail.com',
      queryParameters: {
        'subject': 'Feedback de GridView',
        'body': message,
      },
    );

    try {
      if (await canLaunchUrl(emailUrl)) {
        await launchUrl(emailUrl, mode: LaunchMode.externalApplication);
      } else {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context)!.couldNotOpenLink)),
        );
      }
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context)!.errorOccurred)),
      );
    }
  }

  void _showFeedbackDialog(BuildContext context) {
    final TextEditingController feedbackController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Center(
          child: Text(
            AppLocalizations.of(context)!.sendFeedback,
            style: mainTitle.copyWith(color: Colors.red),
          ),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                AppLocalizations.of(context)!.feedbackHint,
                textAlign: TextAlign.justify,
                style: mainText.copyWith(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 15),
              TextField(
                controller: feedbackController,
                maxLines: 5,
                decoration: InputDecoration(
                  hintText: AppLocalizations.of(context)!.writeYourFeedback,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  filled: true,
                  fillColor: Colors.grey[800],
                ),
                style: const TextStyle(color: Colors.white),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              AppLocalizations.of(context)!.cancel,
              style: mainText.copyWith(color: Colors.red),
            ),
          ),
          TextButton(
            onPressed: () {
              final message = feedbackController.text.trim();
              if (message.isNotEmpty) {
                _sendFeedback(message, context);
                Navigator.pop(context);
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(AppLocalizations.of(context)!.feedbackEmpty),
                  ),
                );
              }
            },
            child: Text(
              AppLocalizations.of(context)!.send,
              style: mainText.copyWith(color: Colors.red),
            ),
          ),
        ],
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        backgroundColor: Colors.grey[850],
      ),
    );
  }



  @override
  Widget build(BuildContext context) {
    final String iconPath = "assets/images/icons/";
    final languageProvider = Provider.of<LanguageProvider>(context);
    final currentLocale = languageProvider.locale;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          AppLocalizations.of(context)!.settings,
          style: mainTitle,
        ),
        centerTitle: true,
      ),
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: Column(
        children: [

          SizedBox(height: 10),

          // Botón de tema
          SettingsButton(
            iconPath: '${iconPath}theme.png',
            text: AppLocalizations.of(context)!.theme,
            onTap: () {},
            trailing: CupertinoSwitch(
              value: Provider.of<ThemeProvider>(context, listen: false).isDarkMode,
              onChanged: (value) =>
                  Provider.of<ThemeProvider>(context, listen: false).toggleTheme(),
            ),
          ),

          // Botón de idioma
          SettingsButton(
            iconPath: '${iconPath}language.png',
            text: AppLocalizations.of(context)!.language,
            onTap: () {},
            trailing: DropdownButton<Locale>(
              value: currentLocale,
              icon: const Icon(Icons.arrow_drop_down, color: Colors.white),
              dropdownColor: Colors.red,
              style: secondaryText.copyWith(
                color: Colors.white60,
                fontWeight: FontWeight.bold,
              ),
              onChanged: (Locale? newLocale) {
                if (newLocale != null) {
                  languageProvider.setLocale(newLocale);
                }
              },
              items: L10n.all.map((locale) {
                final name = L10n.getLanguageName(locale.languageCode);
                return DropdownMenuItem(
                  value: locale,
                  child: Text(name),
                );
              }).toList(),
            ),
          ),

          /* Botón de últimas actualizaciones
          SettingsButton(
            iconPath: '${iconPath}notifications.png',
            text: "Notifications",
            onTap: () => _showUpdatesDialog(context),
            borderRadius: 2,
          ),*/

          // Botón de últimas actualizaciones
          SettingsButton(
            iconPath: '${iconPath}developments.png',
            text: "${AppLocalizations.of(context)!.latestDevelopments} (v1.2.1)",
            onTap: () => UpdatesDialog.show(context),
            borderRadius: 2,
          ),

          // Botón de donación
          SettingsButton(
            iconPath: '${iconPath}coffee.png',
            text: AppLocalizations.of(context)!.donate,
            onTap: () => _launchUrl('https://buymeacoffee.com/gridview', context),
          ),

          // Botón de Instagram
          SettingsButton(
            iconPath: '${iconPath}instagram.png',
            text: "Instagram",
            onTap: () => _launchUrl('https://www.instagram.com/gridviewapp/', context),
            borderRadius: 2,
          ),

          // Nuevo botón de Feedback
          SettingsButton(
            iconPath: '${iconPath}feedback.png',
            text: AppLocalizations.of(context)!.sendFeedback,
            onTap: () => _showFeedbackDialog(context),
            borderRadius: 2,
          ),

          // Botón de políticas de privacidad
          SettingsButton(
            iconPath: '${iconPath}privacy_policy.png',
            text: AppLocalizations.of(context)!.privacyPolicies,
            onTap: () => _launchUrl('https://gridview.netlify.app', context),
          ),
        ],
      ),
    );
  }
}
