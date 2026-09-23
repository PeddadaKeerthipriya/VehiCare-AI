import os
from PIL import Image, ImageDraw, ImageFont


def create_sample_invoice_1(output_path: str):
    """
    Sample 1: Clean, standard vehicle service slip image.
    """
    img = Image.new('RGB', (800, 1000), color=(255, 255, 255))
    d = ImageDraw.Draw(img)

    lines = [
        "APEX AUTOMOTIVE SERVICE CENTER",
        "123 Repair Street, Auto City",
        "Phone: (555) 019-2834",
        "--------------------------------------------------",
        "INVOICE #: INV-2026-0817",
        "Date: 2026-08-15",
        "Vehicle: 2022 Toyota RAV4",
        "VIN: 4T1B11HK5NW123456",
        "Odometer / Mileage: 45,210 km",
        "--------------------------------------------------",
        "SERVICE DESCRIPTION                       AMOUNT",
        "--------------------------------------------------",
        "1. Full Synthetic Oil & Filter Change     $ 65.00",
        "2. Tire Rotation & Wheel Balance          $ 45.00",
        "3. Multi-Point Safety Inspection          $ 30.00",
        "--------------------------------------------------",
        "PARTS REPLACED:",
        "- Engine Oil Filter (P/N: 90915-YZZN1)   $ 12.50",
        "- 5W-30 Synthetic Oil (5 Quarts)          $ 35.00",
        "--------------------------------------------------",
        "TOTAL COST: $ 187.50",
        "--------------------------------------------------",
        "Notes: Customer reported slight brake squeak. Brakes inspected,",
        "pads at 7mm (good condition). Next service due at 55,000 km.",
        "Thank you for your business!"
    ]

    y = 40
    for line in lines:
        d.text((40, y), line, fill=(0, 0, 0))
        y += 32

    img.save(output_path)
    print(f"Created sample invoice 1: {output_path}")


def create_sample_invoice_2(output_path: str):
    """
    Sample 2: Messy/handwritten style invoice with partial/unclear fields.
    """
    img = Image.new('RGB', (800, 1000), color=(245, 245, 240))
    d = ImageDraw.Draw(img)

    lines = [
        "JOE'S GARAGE & REPAIR",
        "Date: 12/04/2026",
        "Mileage: ??? (unclear reading ~ 68000)",
        "--------------------------------------------------",
        "Brake Pad Replace Rear                $140.00",
        "Brake Rotor Resurface                 $ 90.00",
        "Fluid Topup                           $ 15.00",
        "Part: Rear Brake Pads (B-8921)        $ 45.00",
        "--------------------------------------------------",
        "Total: $290.00",
        "Notes: Rear brake pads worn out."
    ]

    y = 50
    for line in lines:
        d.text((50, y), line, fill=(20, 20, 50))
        y += 45

    img.save(output_path)
    print(f"Created sample invoice 2: {output_path}")


def create_sample_invoice_3(output_path: str):
    """
    Sample 3: Invoice with missing fields (no date, no mileage).
    """
    img = Image.new('RGB', (800, 1000), color=(255, 255, 255))
    d = ImageDraw.Draw(img)

    lines = [
        "FAST LUBE & OIL EXPRESS",
        "Invoice #: 98124",
        "--------------------------------------------------",
        "Oil Change Service                    $ 49.99",
        "Air Filter Replacement                $ 24.99",
        "--------------------------------------------------",
        "TOTAL: $ 74.98",
        "Notes: Routine oil service."
    ]

    y = 40
    for line in lines:
        d.text((40, y), line, fill=(0, 0, 0))
        y += 35

    img.save(output_path)
    print(f"Created sample invoice 3: {output_path}")


if __name__ == "__main__":
    os.makedirs("samples", exist_ok=True)
    create_sample_invoice_1("samples/sample_invoice_1.png")
    create_sample_invoice_2("samples/sample_invoice_2.png")
    create_sample_invoice_3("samples/sample_invoice_3.png")
