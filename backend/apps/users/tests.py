from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import User


class AuthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="rep@vaeyu.local", password="password123", role=User.Role.SALES_REP
        )

    def test_login_returns_access_token_and_user_and_sets_refresh_cookie(self):
        response = self.client.post(
            reverse("token-obtain-pair"),
            {"email": "rep@vaeyu.local", "password": "password123"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "rep@vaeyu.local")
        self.assertEqual(response.data["user"]["role"], User.Role.SALES_REP)

        cookie = response.cookies.get("refresh_token")
        self.assertIsNotNone(cookie)
        self.assertTrue(cookie["httponly"])

    def test_login_with_wrong_password_fails(self):
        response = self.client.post(
            reverse("token-obtain-pair"),
            {"email": "rep@vaeyu.local", "password": "wrong"},
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_uses_cookie_and_rotates_it(self):
        login = self.client.post(
            reverse("token-obtain-pair"),
            {"email": "rep@vaeyu.local", "password": "password123"},
        )
        old_cookie = login.cookies["refresh_token"].value
        self.client.cookies["refresh_token"] = old_cookie

        response = self.client.post(reverse("token-refresh"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        new_cookie = response.cookies.get("refresh_token")
        self.assertIsNotNone(new_cookie)
        self.assertNotEqual(new_cookie.value, old_cookie)

    def test_refresh_without_cookie_fails(self):
        response = self.client.post(reverse("token-refresh"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_blacklists_refresh_cookie(self):
        login = self.client.post(
            reverse("token-obtain-pair"),
            {"email": "rep@vaeyu.local", "password": "password123"},
        )
        self.client.cookies["refresh_token"] = login.cookies["refresh_token"].value

        response = self.client.post(reverse("logout"))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(response.cookies["refresh_token"].value, "")

        refresh_response = self.client.post(reverse("token-refresh"))
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_auth(self):
        response = self.client.get(reverse("me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("me"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "rep@vaeyu.local")


class UserViewSetTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@vaeyu.local", password="password123", role=User.Role.ADMIN
        )
        self.rep = User.objects.create_user(
            email="rep@vaeyu.local", password="password123", role=User.Role.SALES_REP
        )

    def test_sales_rep_cannot_list_users(self):
        self.client.force_authenticate(self.rep)
        response = self.client.get(reverse("user-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_users(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("user-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_can_create_user(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("user-list"),
            {
                "email": "newrep@vaeyu.local",
                "password": "newpassword123",
                "first_name": "New",
                "last_name": "Rep",
                "role": User.Role.SALES_REP,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created = User.objects.get(email="newrep@vaeyu.local")
        self.assertTrue(created.check_password("newpassword123"))

    def test_admin_can_set_password(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("user-set-password", args=[self.rep.id]),
            {"password": "anotherpassword123"},
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.rep.refresh_from_db()
        self.assertTrue(self.rep.check_password("anotherpassword123"))
