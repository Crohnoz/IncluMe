class SecurityHeadersMiddleware:
    """Apply conservative browser capabilities without blocking map imagery."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault(
            "Permissions-Policy",
            "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
        )
        response.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        return response
