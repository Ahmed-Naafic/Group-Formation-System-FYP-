import 'package:get/get.dart';
import '../modules/auth/bindings/auth_binding.dart';
import '../modules/auth/views/change_password_view.dart';
import '../modules/auth/views/login_view.dart';
import '../modules/chat/bindings/chat_binding.dart';
import '../modules/chat/views/chat_view.dart';
import '../modules/dashboard/bindings/dashboard_binding.dart';
import '../modules/dashboard/views/dashboard_view.dart';
import '../modules/feedback/controllers/feedback_controller.dart';
import '../modules/feedback/views/feedback_view.dart';
import '../modules/files/bindings/files_binding.dart';
import '../modules/files/views/files_view.dart';
import '../modules/main/views/main_shell.dart';
import '../modules/notifications/views/notifications_view.dart';
import '../modules/performance/bindings/performance_binding.dart';
import '../modules/performance/views/performance_view.dart';
import '../modules/splash/views/splash_view.dart';
import '../modules/tasks/bindings/task_binding.dart';
import '../modules/tasks/views/task_detail_view.dart';
import '../modules/tasks/views/task_list_view.dart';
import '../modules/workspace/views/workspace_detail_view.dart';

part 'app_routes.dart';

class AppPages {
  static const initial = Routes.splash;

  static final routes = [
    GetPage(
      name: Routes.splash,
      page: () => const SplashView(),
    ),
    GetPage(
      name: Routes.login,
      page: () => const LoginView(),
      binding: AuthBinding(),
    ),
    GetPage(
      name: Routes.changePassword,
      page: () => const ChangePasswordView(),
      binding: AuthBinding(),
    ),
    GetPage(
      name: Routes.main,
      page: () => const MainShell(),
      binding: DashboardBinding(),
    ),
    GetPage(
      name: Routes.dashboard,
      page: () => const DashboardView(),
      binding: DashboardBinding(),
    ),
    GetPage(
      name: Routes.workspace,
      page: () => const WorkspaceDetailView(),
    ),
    GetPage(
      name: Routes.tasks,
      page: () => const TaskListView(),
      binding: TaskBinding(),
    ),
    GetPage(
      name: Routes.taskDetail,
      page: () => const TaskDetailView(),
    ),
    GetPage(
      name: Routes.chat,
      page: () => const ChatView(),
      binding: ChatBinding(),
    ),
    GetPage(
      name: Routes.notifications,
      page: () => const NotificationsView(),
    ),
    GetPage(
      name: Routes.files,
      page: () => const FilesView(),
      binding: FilesBinding(),
    ),
    GetPage(
      name: Routes.performance,
      page: () => const PerformanceView(),
      binding: PerformanceBinding(),
    ),
    GetPage(
      name: Routes.feedback,
      page: () => const FeedbackView(),
      binding: BindingsBuilder(() {
        final groupId = Get.arguments as String;
        Get.lazyPut<FeedbackController>(() => FeedbackController(groupId: groupId));
      }),
    ),
  ];
}
