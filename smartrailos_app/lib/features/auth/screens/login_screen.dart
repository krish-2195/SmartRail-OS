import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/theme.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  void _handleLogin({String? overrideId, String? overridePass}) async {
    final id = overrideId ?? _identifierController.text.trim();
    final pass = overridePass ?? _passwordController.text;

    if (id.isEmpty || pass.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your Passenger ID and password')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ref.read(authProvider.notifier).login(id, pass);
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.signalRed,
            content: Text('Login failed: ${e.toString().replaceAll("Exception: ", "")}'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surfaceDark,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 36),
              // Logo Line bars
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 12,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppTheme.blueLine,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ).animate().scaleY(begin: 0, duration: 600.ms, curve: Curves.easeOutBack),
                  const SizedBox(width: 8),
                  Container(
                    width: 12,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppTheme.redLine,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ).animate().scaleY(begin: 0, duration: 600.ms, delay: 200.ms, curve: Curves.easeOutBack),
                ],
              ),
              const SizedBox(height: 24),
              Text(
                'SMARTRAIL OS',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.5,
                  color: AppTheme.textPrimary,
                ),
                textAlign: TextAlign.center,
              ).animate().fadeIn(delay: 300.ms),
              const SizedBox(height: 6),
              const Text(
                'PASSENGER TRANSIT PORTAL',
                style: TextStyle(
                  color: AppTheme.blueLine,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                  letterSpacing: 1.5,
                ),
                textAlign: TextAlign.center,
              ).animate().fadeIn(delay: 400.ms),
              const SizedBox(height: 4),
              const Text(
                'Sign in with your Passenger ID to access real-time transit & coach occupancy',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
                textAlign: TextAlign.center,
              ).animate().fadeIn(delay: 500.ms),
              const SizedBox(height: 40),

              // Passenger ID / Email Field
              TextField(
                controller: _identifierController,
                decoration: InputDecoration(
                  labelText: 'PASSENGER ID OR EMAIL',
                  hintText: 'PASS101 or user@smartrail.os',
                  prefixIcon: const Icon(Icons.badge_outlined, color: AppTheme.blueLine),
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0x1AFFFFFF)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0x1AFFFFFF)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppTheme.blueLine, width: 2),
                  ),
                ),
                keyboardType: TextInputType.text,
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
              ).animate().fadeIn(delay: 600.ms).slideY(begin: 0.1, end: 0),
              const SizedBox(height: 16),

              // Password Field
              TextField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: 'PASSENGER PASSWORD',
                  hintText: '••••••••',
                  prefixIcon: const Icon(Icons.lock_outline, color: AppTheme.blueLine),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: AppTheme.textMuted,
                      size: 20,
                    ),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0x1AFFFFFF)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0x1AFFFFFF)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppTheme.blueLine, width: 2),
                  ),
                ),
                obscureText: _obscurePassword,
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
              ).animate().fadeIn(delay: 700.ms).slideY(begin: 0.1, end: 0),
              const SizedBox(height: 32),

              // Sign In Button
              ElevatedButton(
                onPressed: _isLoading ? null : () => _handleLogin(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.blueLine,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(54),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 4,
                ),
                child: _isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('PASSENGER SIGN IN', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.0)),
              ).animate().fadeIn(delay: 800.ms).scale(begin: const Offset(0.95, 0.95)),

              const SizedBox(height: 24),

              // ── 1-Click Quick Demo Passenger Login ──
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.blueLine.withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '⚡ QUICK PASSENGER DEMO',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.blueLine,
                            letterSpacing: 1.0,
                          ),
                        ),
                        Text(
                          'PASS101 / pass123',
                          style: TextStyle(fontSize: 10, fontFamily: 'monospace', color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _isLoading
                          ? null
                          : () {
                              _identifierController.text = 'PASS101';
                              _passwordController.text = 'pass123';
                              _handleLogin(overrideId: 'PASS101', overridePass: 'pass123');
                            },
                      icon: const Icon(Icons.flash_on_rounded, size: 16, color: AppTheme.signalAmber),
                      label: const Text(
                        '1-CLICK PASSENGER SIGN IN',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0x26FFFFFF)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(delay: 900.ms),

              const SizedBox(height: 28),

              // Create Account Link
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('NEW COMMUTER? ', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                  TextButton(
                    onPressed: () => context.push('/register'),
                    child: const Text(
                      'CREATE PASSENGER ACCOUNT',
                      style: TextStyle(color: AppTheme.blueLine, fontWeight: FontWeight.w900, fontSize: 12),
                    ),
                  ),
                ],
              ).animate().fadeIn(delay: 1000.ms),
            ],
          ),
        ),
      ),
    );
  }
}

