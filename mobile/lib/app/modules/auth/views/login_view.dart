import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../controllers/auth_controller.dart';

class LoginView extends StatefulWidget {
  const LoginView({super.key});

  @override
  State<LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<LoginView> {
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl   = TextEditingController();
  final _obscure        = true.obs;
  late final AuthController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Get.find<AuthController>();
    _controller.errorMessage.value = '';
  }

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
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
                // Brand mark
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(80),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Text(
                      'J',
                      style: TextStyle(
                        fontSize: 40,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E3A8A),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'JUST',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Group Formation System',
                  style: TextStyle(color: Color(0xFF8A92A4), fontSize: 13),
                ),
                const SizedBox(height: 40),

                // Form card — adapts to theme
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
                      Text(
                        'Sign In',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: context.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Student portal',
                        style: TextStyle(fontSize: 13, color: context.textMuted),
                      ),
                      const SizedBox(height: 28),

                      // Student ID / email
                      TextField(
                        controller: _identifierCtrl,
                        textInputAction: TextInputAction.next,
                        style: TextStyle(color: context.textPrimary),
                        decoration: _inputDecoration(
                          context: context,
                          label: 'Student ID or Email',
                          icon: Icons.person_outline_rounded,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Password
                      Obx(
                        () => TextField(
                          controller: _passwordCtrl,
                          obscureText: _obscure.value,
                          textInputAction: TextInputAction.done,
                          style: TextStyle(color: context.textPrimary),
                          onSubmitted: (_) => _controller.login(
                            _identifierCtrl.text,
                            _passwordCtrl.text,
                          ),
                          decoration: _inputDecoration(
                            context: context,
                            label: 'Password',
                            icon: Icons.lock_outline_rounded,
                          ).copyWith(
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscure.value
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                color: context.textMuted,
                              ),
                              onPressed: () =>
                                  _obscure.value = !_obscure.value,
                            ),
                          ),
                        ),
                      ),

                      // Error banner
                      Obx(() {
                        if (_controller.errorMessage.isEmpty) {
                          return const SizedBox(height: 20);
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

                      // Sign-in button
                      Obx(
                        () => SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _controller.isLoading.value
                                ? null
                                : () => _controller.login(
                                      _identifierCtrl.text,
                                      _passwordCtrl.text,
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
                                    'Sign In',
                                    style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600),
                                  ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),
                const Text(
                  'Jamhuriya University of Science & Technology',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF424A5E), fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required BuildContext context,
    required String label,
    required IconData icon,
  }) =>
      InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: context.textMuted, fontSize: 14),
        prefixIcon: Icon(icon, color: context.textMuted, size: 20),
        filled: true,
        fillColor: context.inputFill,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: context.inputBorderNone(),
        enabledBorder: context.inputBorderEnabled(),
        focusedBorder: context.inputBorderFocused,
      );
}
