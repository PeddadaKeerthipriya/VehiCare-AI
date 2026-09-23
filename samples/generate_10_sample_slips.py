import os
from PIL import Image, ImageDraw, ImageFilter


def create_slip(filename: str, lines: list, bg_color=(255, 255, 255), text_color=(0, 0, 0), apply_blur=False):
    img = Image.new('RGB', (800, 1000), color=bg_color)
    d = ImageDraw.Draw(img)

    y = 40
    for line in lines:
        d.text((40, y), line, fill=text_color)
        y += 32

    if apply_blur:
        img = img.filter(ImageFilter.GaussianBlur(radius=1))

    os.makedirs("samples/slips_10", exist_ok=True)
    filepath = os.path.join("samples/slips_10", filename)
    img.save(filepath)
    print(f"Generated sample slip: {filepath}")
    return filepath


def generate_all_10_sample_slips():
    # 1. Clear Standard Receipt
    create_slip("sample_01_clear_standard.png", [
        "APEX AUTOMOTIVE SERVICE CENTER",
        "Invoice #: INV-2026-01",
        "Date: 2026-08-15",
        "Mileage: 45210 km",
        "--------------------------------------------------",
        "1. Synthetic Oil Change                 $ 65.00",
        "2. Tire Rotation                        $ 45.00",
        "Part: Oil Filter (P/N 90915-YZZN1)      $ 12.50",
        "--------------------------------------------------",
        "TOTAL: $ 122.50",
        "Notes: Routine service performed."
    ])

    # 2. Messy / Handwritten Style
    create_slip("sample_02_messy_handwritten.png", [
        "JOES GARAGE REPAIR",
        "Date: 12/04/2026",
        "Mileage: ~68000 km",
        "--------------------------------------------------",
        "Brake Pad Replace Rear                  $ 140.00",
        "Brake Rotor Resurface                   $ 90.00",
        "Part: Rear Brake Pads (B-8921)          $ 45.00",
        "--------------------------------------------------",
        "Total: $ 275.00",
        "Notes: Rear pads severely worn."
    ], bg_color=(245, 245, 240), text_color=(20, 20, 50))

    # 3. Missing Mileage
    create_slip("sample_03_missing_mileage.png", [
        "METRO AUTO CARE",
        "Invoice: M-9912",
        "Date: 2026-07-20",
        "Mileage: N/A",
        "--------------------------------------------------",
        "Air Conditioner Recharge                $ 110.00",
        "Cabin Filter Change                     $ 35.00",
        "--------------------------------------------------",
        "TOTAL COST: $ 145.00",
        "Notes: AC blowing cold air now."
    ])

    # 4. Missing Date
    create_slip("sample_04_missing_date.png", [
        "QUICK LUBE & TIRE",
        "Odometer: 52,400",
        "--------------------------------------------------",
        "Transmission Fluid Flush                $ 180.00",
        "Wiper Blades Replacement                $ 30.00",
        "--------------------------------------------------",
        "AMOUNT DUE: $ 210.00",
        "Notes: Customer requested transmission check."
    ])

    # 5. Missing Costs
    create_slip("sample_05_missing_costs.png", [
        "DEALERSHIP SERVICE RECORD",
        "Date: 2026-05-10",
        "Odometer: 30000 km",
        "--------------------------------------------------",
        "Warranty Inspection                     Included",
        "Software Update Module ECU              Included",
        "Part: Gasket Shield                     $ 15.00",
        "--------------------------------------------------",
        "TOTAL CHARGED: $ 15.00",
        "Notes: Covered under OEM warranty."
    ])

    # 6. Blurry / Low Contrast OCR
    create_slip("sample_06_blurry_ocr.png", [
        "CITY MOTORS WORKSHOP",
        "Date: 2026-03-18",
        "Mileage: 78900",
        "--------------------------------------------------",
        "Battery Replacement 12V                 $ 160.00",
        "Part: Heavy Duty Battery (P/N BAT-12V)  $ 140.00",
        "--------------------------------------------------",
        "TOTAL: $ 300.00",
        "Notes: Old battery failed load test."
    ], bg_color=(220, 220, 220), text_color=(50, 50, 50), apply_blur=True)

    # 7. Custom Parts & Labor
    create_slip("sample_07_custom_parts.png", [
        "PERFORMANCE AUTO TECH",
        "Date: 2026-06-22",
        "Mileage: 12000 km",
        "--------------------------------------------------",
        "Front Strut Assembly Replace            $ 350.00",
        "Wheel Alignment 4-Wheel                 $ 95.00",
        "Part: Left Strut (P/N STR-FL-99)        $ 210.00",
        "Part: Right Strut (P/N STR-FR-99)       $ 210.00",
        "--------------------------------------------------",
        "TOTAL: $ 865.00",
        "Notes: Replaced damaged front struts."
    ])

    # 8. Heavy Background Noise
    create_slip("sample_08_heavy_noise.png", [
        "EXPRESS TIRE & SERVICE",
        "Date: 2026-02-14",
        "Mileage: 88500 km",
        "--------------------------------------------------",
        "Tire Replacement 4 Wheels               $ 480.00",
        "Valve Stem Replacement                  $ 20.00",
        "--------------------------------------------------",
        "TOTAL PAID: $ 500.00",
        "Notes: Mounted 4 all-season tires."
    ], bg_color=(230, 225, 210), text_color=(30, 40, 30))

    # 9. Multi-Item Long Invoice Layout
    create_slip("sample_09_multi_item_long.png", [
        "PREMIER VEHICLE CARE CENTER",
        "Date: 2026-08-01",
        "Mileage: 64100 km",
        "--------------------------------------------------",
        "Engine Tuneup & Spark Plugs             $ 190.00",
        "Fuel System Cleaner                     $ 45.00",
        "Coolant Flush                           $ 85.00",
        "Brake Fluid Drain & Fill                $ 75.00",
        "Part: Platinum Spark Plugs x4           $ 60.00",
        "Part: Engine Coolant 1 Gal              $ 25.00",
        "--------------------------------------------------",
        "TOTAL: $ 480.00",
        "Notes: Comprehensive 60k km service package."
    ])

    # 10. Illegible / Damaged Text Slip
    create_slip("sample_10_illegible_damaged.png", [
        "OLD ROAD SERVICE",
        "Date: ??/??/2026",
        "Mileage: ??????",
        "--------------------------------------------------",
        "Check Engine Light Diagnosis            $ 85.00",
        "Notes: Code P0300 misfire detected.",
        "--------------------------------------------------",
        "TOTAL: $ 85.00"
    ], bg_color=(210, 210, 210), apply_blur=True)


if __name__ == "__main__":
    generate_all_10_sample_slips()
