# Slime Elemental Prototype

Prototype game theo yêu cầu:

- Slime người chơi **di chuyển** + **tấn công**
- Slime địch theo **5 nguyên tố**: Nước, Lửa, Gió, Đất, Kim loại
- Hạ địch → nhận **EXP** + nhận **Shard** theo nguyên tố → đủ mốc shard sẽ **mở skill mới** theo nguyên tố đó

## Chạy game

Yêu cầu: cài Node.js (khuyến nghị Node 18+).

Trong thư mục repo:

```bash
npm install
npm run dev
```

Sau đó mở địa chỉ Vite in ra trong terminal (thường là `http://localhost:5173/`).

## Điều khiển

- Move: `WASD` / `Arrow`
- Attack: `Space`
- Dash: `Shift`
- Skills: `1-5` (1=Nước, 2=Lửa, 3=Gió, 4=Đất, 5=Kim loại — mở khóa theo shard)

