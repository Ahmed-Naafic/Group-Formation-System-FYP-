import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get/get.dart';

class ThemeController extends GetxController {
  static const _key = 'theme_mode';
  final _storage = const FlutterSecureStorage();

  final isDark = false.obs;

  @override
  void onInit() {
    super.onInit();
    _load();
  }

  Future<void> _load() async {
    final val = await _storage.read(key: _key);
    isDark.value = val == 'dark';
    Get.changeThemeMode(isDark.value ? ThemeMode.dark : ThemeMode.light);
  }

  Future<void> toggle() async {
    isDark.value = !isDark.value;
    Get.changeThemeMode(isDark.value ? ThemeMode.dark : ThemeMode.light);
    await _storage.write(key: _key, value: isDark.value ? 'dark' : 'light');
  }
}
