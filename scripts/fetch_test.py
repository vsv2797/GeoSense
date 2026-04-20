import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_climate_api():
    print("Fetching RestCountries...")
    req = urllib.request.Request("https://restcountries.com/v3.1/all?fields=cca3,latlng", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx) as r:
        rc = json.loads(r.read())
        print(f"Loaded {len(rc)} countries.")
        
    print("Fetching Open-Meteo Air Quality (Testing Batch Coordinates)...")
    lats = "52.52,48.85"
    lngs = "13.41,2.35"
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lats}&longitude={lngs}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            res = json.loads(r.read())
            arr = res if isinstance(res, list) else [res]
            print(f"SUCCESS: Received {len(arr)} nodes of air quality data.")
            for node in arr:
                print(node['current'])
    except Exception as e:
        print(f"FATAL:", str(e))

if __name__ == "__main__":
    test_climate_api()
