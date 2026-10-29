from django.urls import path

from .consumers import MissionConsumer

websocket_urlpatterns = [path("ws/missions/", MissionConsumer.as_asgi())]