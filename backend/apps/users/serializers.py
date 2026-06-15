from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal representation used when nesting users inside other resources."""

    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "name", "role"]

    def get_name(self, obj):
        return obj.get_full_name() or obj.email


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "name",
            "role",
            "is_active",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def get_name(self, obj):
        return obj.get_full_name() or obj.email


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "password",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class SetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds the authenticated user's profile to the token response."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
