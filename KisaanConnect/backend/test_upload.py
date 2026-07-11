import requests

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0ZmFybWVyIiwicm9sZSI6ImZhcm1lciIsImV4cCI6MTc4Mzg0MjYzM30.8wpu3YOScXZCdkSkgdciQ242Xq2vAeP1SYTtUPoCGug'
image_path = r'D:\MY PROJECTS\KisaanConnect 1\KisaanConnect\backend\test_crop.jpg'

with open(image_path, 'rb') as f:
    files = {'file': ('test_crop.jpg', f, 'image/jpeg')}
    headers = {'Authorization': f'Bearer {token}'}
    r = requests.post('http://localhost:8000/upload/image', files=files, headers=headers)
    print(r.status_code)
    print(r.json())
