// Change this one constant to point the whole app at a different server.
// On Android with `adb reverse tcp:5000 tcp:5000`, localhost works on physical
// devices too. For a production build, replace with the real server URL.
const String kServerUrl  = 'http://localhost:5000';
const String kApiBaseUrl = '$kServerUrl/api';
