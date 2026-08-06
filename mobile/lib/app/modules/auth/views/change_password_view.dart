import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../controllers/auth_controller.dart';

class ChangePasswordView extends StatefulWidget {
  const ChangePasswordView({super.key});

  @override
  State<ChangePasswordView> createState() => _ChangePasswordViewState();
}

class _ChangePasswordViewState extends State<ChangePasswordView> {
  final _newPassCtrl     = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  final _obscureNew      = true.obs;
  final _obscureConfirm  = true.obs;
  late final AuthController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Get.find<AuthController>();
    _controller.errorMessage.value = '';
  }

  @override
  void dispose() {
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0C1738),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Icon
                Container(
                  width: 70,
                  height: 70,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E3A8A),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(
                    Icons.lock_reset_rounded,
                    color: Colors.white,
                    size: 34,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Set Your Password',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Your account requires a new password before you can continue.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF8A92A4), fontSize: 13),
                  ),
                ),
                const SizedBox(height: 36),

                // Card — adapts to theme
                Container(
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    color: context.cardColor,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(80),
                        blurRadius: 40,
                        offset: const Offset(0, 16),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // New password
                      Obx(
                        () => TextField(
                          controller: _newPassCtrl,
                          obscureText: _obscureNew.value,
                          textInputAction: TextInputAction.next,
                          style: TextStyle(color: context.textPrimary),
                          decoration: _inputDecoration(context, 'New Password').copyWith(
                            suffixIcon: _visibilityBtn(
                              context,
                              _obscureNew.value,
                              () => _obscureNew.value = !_obscureNew.value,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Confirm password
                      Obx(
                        () => TextField(
                          controller: _confirmPassCtrl,
                          obscureText: _obscureConfirm.value,
                          textInputAction: TextInputAction.done,
                          style: TextStyle(color: context.textPrimary),
                          onSubmitted: (_) => _controller.changePassword(
                            _newPassCtrl.text,
                            _confirmPassCtrl.text,
                          ),
                          decoration: _inputDecoration(context, 'Confirm Password').copyWith(
                            suffixIcon: _visibilityBtn(
                              context,
                              _obscureConfirm.value,
                              () => _obscureConfirm.value = !_obscureConfirm.value,
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 10),
                      Text(
                        'Min 6 characters · uppercase · lowercase · number',
                        style: TextStyle(color: context.textMuted, fontSize: 11),
                      ),

                      // Error banner
                      Obx(() {
                        if (_controller.errorMessage.isEmpty) {
                          return const SizedBox(height: 16);
                        }
                        return Container(
                          margin: const EdgeInsets.only(top: 14),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFFECACA)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded,
                                  color: Color(0xFFB23A3A), size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _controller.errorMessage.value,
                                  style: const TextStyle(
                                      color: Color(0xFFB23A3A), fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),

                      const SizedBox(height: 24),

                      // Submit button
                      Obx(
                        () => SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _controller.isLoading.value
                                ? null
                                : () => _controller.changePassword(
                                      _newPassCtrl.text,
                                      _confirmPassCtrl.text,
                                    ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1E3A8A),
                              foregroundColor: Colors.white,
                              disabledBackgroundColor:
                                  const Color(0xFF1E3A8A).withAlpha(120),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              elevation: 0,
                            ),
                            child: _controller.isLoading.value
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2.5,
                                    ),
                                  )
                                : const Text(
                                    'Set Password & Continue',
                                    style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600),
                                  ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(BuildContext context, String label) =>
      InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: context.textMuted, fontSize: 14),
        prefixIcon: Icon(Icons.lock_outline_rounded,
            color: context.textMuted, size: 20),
        filled: true,
        fillColor: context.inputFill,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: context.inputBorderNone(),
        enabledBorder: context.inputBorderEnabled(),
        focusedBorder: context.inputBorderFocused,
      );

  Widget _visibilityBtn(
    BuildContext context,
    bool obscure,
    VoidCallback onTap,
  ) =>
      IconButton(
        icon: Icon(
          obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
          color: context.textMuted,
        ),
        onPressed: onTap,
      );
}
