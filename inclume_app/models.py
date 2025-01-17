from django.db import models

class Parking(models.Model):
    location = models.CharField(max_length=255)
    accessibility_info = models.TextField()

class EducationalResource(models.Model):
    title = models.CharField(max_length=255)
    content = models.TextField()

class DiscriminationReport(models.Model):
    report_date = models.DateTimeField(auto_now_add=True)
    details = models.TextField()
