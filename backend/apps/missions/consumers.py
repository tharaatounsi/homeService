from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class MissionConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close(code=4401)
            return
        self.joined = [f"user_{user.id}"]
        if user.role == "technician":
            ids = await self._category_ids(user)
            self.joined += [f"tech_category_{i}" for i in ids]
        for group in self.joined:
            await self.channel_layer.group_add(group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        for group in getattr(self, "joined", []):
            await self.channel_layer.group_discard(group, self.channel_name)

    @database_sync_to_async
    def _category_ids(self, user):
        profile = getattr(user, "technician_profile", None)
        if not profile or not profile.is_approved:
            return []
        return list(profile.categories.values_list("id", flat=True))

    async def request_new(self, event):
        await self.send_json({"kind": "request.new", **event["data"]})

    async def request_status(self, event):
        await self.send_json({"kind": "request.status", **event["data"]})

    async def request_closed(self, event):
        await self.send_json({"kind": "request.closed", **event["data"]})