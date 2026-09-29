# Kru Check PWA

PWA แบบ Vanilla HTML/CSS/JavaScript สำหรับพัฒนา Kru Check ให้ตรวจข้อสอบบนอุปกรณ์ได้โดยไม่ส่งภาพไปหา Python server

## สถานะปัจจุบัน

Phase 1 เชื่อม Browser OMR สำหรับรูปที่ถ่ายมาแล้วเข้ากับ `js/services/omrService.js` แล้ว โดยทำงานใน Browser ด้วย OpenCV.js/WASM ที่เก็บอยู่ในโครงการ ไม่เรียก Flask, localhost, Cloudflare หรือ API ภายนอก

ขอบเขตที่มีใน Phase 1:

- ตรวจ marker 4 มุม หมุนภาพ และแก้ perspective
- ฟอร์มมาตรฐาน 20/40/60 ข้อตาม geometry เดิม
- ฟอร์มเก่าแบบตารางกากบาท 40 ข้อ
- Legacy 3-marker recovery เมื่อกู้ได้อย่างปลอดภัย
- X Recognition V2, thin/faint X และ neighboring-X ownership
- แยกคำตอบเดียว, blank, multiple และรายการที่ต้องตรวจทาน
- คำนวณคะแนนเมื่อมีเฉลย
- ใช้รูปที่ได้รับมาแล้วเท่านั้น

สิ่งที่ยัง **ไม่อยู่ใน Phase 1**:

- Continuous Scan Offline / วงจรกล้องสด / WAIT_REMOVE
- การซิงก์ Google Apps Script และ authentication จริง
- การ deploy Production
- การยืนยันประสิทธิภาพและหน่วยความจำบน iPhone จริง

หน้า `#/scan` เชื่อม Browser OMR แล้ว แต่ UI ส่วนข้อมูลและระบบอื่นยังมี mock ตามสถาปัตยกรรมเดิม จึงยังไม่ควรเรียกทั้งแอปว่า Production-ready

## Browser OMR

Application-facing interface อยู่ที่:

- `js/services/omrService.js`
- `BrowserOmrService.processAnswerSheet(image, options)`

โมดูล OMR อยู่ใต้ `js/omr/` แยกเป็น marker detection, alignment, preprocessing, recognition, template และ core orchestration

ไฟล์ runtime ที่ต้องอยู่ใน cache เพื่อใช้งานออฟไลน์:

- `vendor/opencv/opencv.js`
- `vendor/opencv/opencv.wasm`
- โมดูลทั้งหมดใต้ `js/omr/`
- `js/omr/templates/accepted-marks.json`

รายการนี้ถูกระบุไว้ใน `sw.js` แล้ว

## Accepted marks

Python OMR ยังใช้ `accepted_marks.npz` เป็น template เสริมของ X Recognition V2

ไฟล์ Browser `js/omr/templates/accepted-marks.json` มีเฉพาะ mask ตัวเลข `uint8` ขนาด `17 x 31 x 31` ไม่มีชื่อ นักเรียน ห้องเรียน หรือข้อมูลส่วนบุคคล สร้างซ้ำได้ด้วย:

```sh
../kru-check/.venv/bin/python tools/export_accepted_marks.py \
  ../kru-check/accepted_marks.npz \
  js/omr/templates/accepted-marks.json
```

คำสั่งนี้อ่านและแปลงข้อมูลเท่านั้น ไม่แก้ `accepted_marks.npz`

## OpenCV.js/WASM และใบอนุญาต

เก็บ runtime ไว้ใน `vendor/opencv/` เพื่อไม่พึ่ง CDN:

- wrapper package: `@opencv.js/wasm` 4.4.0 (MIT)
- OpenCV 4.4.0 (BSD-3-Clause)
- ที่มา checksum และใบอนุญาต: `vendor/opencv/README.md` และ `vendor/opencv/OPENCV-LICENSE`

## Parity test

สร้างผลอ้างอิงใหม่จาก Python OMR แล้วรัน Browser OMR ด้วย Chrome แบบ headless:

```sh
npm run test:parity
```

ชุดเปรียบเทียบใช้ fixture ที่ตรวจแล้วว่าไม่มีข้อมูลระบุตัวนักเรียน และเทียบทีละข้อทั้งคำตอบ สถานะ Review เหตุผล คะแนน และความสำเร็จของ alignment

ทดสอบ Node/unit:

```sh
npm test
```

## โครงสร้างส่วนอื่น

- Routing: hash router
- UI: Vanilla HTML/CSS/ES modules
- Local data: repository layer รองรับ mock และ IndexedDB
- Service Worker: app-shell/offline asset cache
- GAS/Auth: ยังเป็น adapter หรือ mock และไม่อยู่ใน Phase 1

ไม่มี build step สำหรับตัวแอป แต่ต้องเปิดผ่าน HTTP/HTTPS เพื่อให้ ES modules, WASM และ Service Worker ทำงานครบ ไม่ควรเปิดด้วย `file://`
