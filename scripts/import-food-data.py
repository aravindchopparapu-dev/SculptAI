"""Extract the eight referenced foods from the public USDA SR Legacy CSV ZIP.

Usage: python scripts/import-food-data.py outputs/usda-sr-legacy.zip
Download URL and content hash are retained with the generated reference data.
No user records or API credentials are involved.
"""
import csv
import hashlib
import io
import json
import sys
from pathlib import Path
from zipfile import ZipFile

archive = Path(sys.argv[1])
ids = {
    "lentils": "172421", "tofu": "172475", "rice": "169704",
    "broccoli": "169967", "oil": "171413", "eggs": "173424",
    "potatoes": "170440", "chicken": "171477",
}
nutrients = {"1008": "calories", "1003": "protein", "1004": "fat", "1005": "carbs"}
with ZipFile(archive) as z:
    def rows(name):
        entry = next(n for n in z.namelist() if n.endswith("/" + name))
        return csv.DictReader(io.TextIOWrapper(z.open(entry), encoding="utf-8-sig"))

    foods = {r["fdc_id"]: {"fdcId": r["fdc_id"], "description": r["description"],
                           "publicationDate": r["publication_date"], "per100g": {}}
             for r in rows("food.csv") if r["fdc_id"] in ids.values()}
    for r in rows("food_nutrient.csv"):
        if r["fdc_id"] in foods and r["nutrient_id"] in nutrients:
            foods[r["fdc_id"]]["per100g"][nutrients[r["nutrient_id"]]] = float(r["amount"])
    assert all(set(f["per100g"]) == set(nutrients.values()) for f in foods.values())
    data = {key: foods[fdc_id] for key, fdc_id in ids.items()}
    source = {
        "name": "USDA FoodData Central · SR Legacy (April 2018)",
        "url": "https://fdc.nal.usda.gov/download-datasets/",
        "archiveUrl": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip",
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "accessed": "2026-09-09",
    }
    output = Path(__file__).resolve().parents[1] / "lib" / "food-data.ts"
    output.write_text("// Generated from USDA reference data by scripts/import-food-data.py.\n"
                      "// Energy is kcal and macronutrients are grams per 100 g edible food.\n"
                      "export const foodSource = " + json.dumps(source, indent=2) + " as const;\n"
                      "export const foodData = " + json.dumps(data, indent=2) + " as const;\n",
                      encoding="utf-8")
    print(f"Extracted {len(data)} food records; source SHA256 {source['sha256']}")
