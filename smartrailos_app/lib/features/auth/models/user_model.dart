class UserModel {
  final String userId;
  final String? userIdCode;
  final String name;
  final String email;
  final String role;
  final String? stationId;

  UserModel({
    required this.userId,
    this.userIdCode,
    required this.name,
    required this.email,
    this.role = 'passenger',
    this.stationId,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      userId: json['id']?.toString() ?? json['userId']?.toString() ?? '',
      userIdCode: json['user_id_code']?.toString() ?? json['userIdCode']?.toString(),
      name: json['full_name']?.toString() ?? json['name']?.toString() ?? json['user_name']?.toString() ?? 'Commuter',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? 'passenger',
      stationId: json['station_id']?.toString() ?? json['stationId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': userId,
      'user_id_code': userIdCode,
      'full_name': name,
      'email': email,
      'role': role,
      'station_id': stationId,
    };
  }
}

