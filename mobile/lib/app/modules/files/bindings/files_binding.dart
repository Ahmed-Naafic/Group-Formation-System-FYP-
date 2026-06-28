import 'package:get/get.dart';
import '../controllers/files_controller.dart';

class FilesBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<FilesController>(() => FilesController());
  }
}
