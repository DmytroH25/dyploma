# ECC-шифрування команд управління

Навчально-демонстраційний веб-застосунок для дипломного проєкту
“Захищена підсистема управління віддаленим рухомим об'єктом”.

Застосунок показує, як команда управління відображається у точку еліптичної
кривої `Tm`, маскується точкою `kG`, передається як криптограма `Tx` і
відновлюється під час дешифрування.

## Запуск

```powershell
.\gradlew.bat bootRun
```

Після запуску відкрийте:

```text
http://localhost:8080
```

## Демонстраційна крива

```text
y^2 = x^3 - 3x + 1 mod 79
p = 79
a = -3
b = 1
G = (76, 46)
n = 81
```

Це мала навчальна крива. Реалізація призначена для пояснення алгоритму в
дипломній роботі, а не для production-ready криптографії.

## Команди

У застосунку використовується 16 команд:

```text
MOVE_FORWARD_5M
MOVE_BACKWARD_5M
TURN_LEFT_5DEG
TURN_RIGHT_5DEG
TURN_LEFT_15DEG
TURN_RIGHT_15DEG
ASCEND_10M
DESCEND_10M
INCREASE_SPEED_5
DECREASE_SPEED_5
CAMERA_LEFT_15DEG
CAMERA_RIGHT_15DEG
CAMERA_UP_10DEG
CAMERA_DOWN_10DEG
ROTATE_180DEG
STOP
```

Повідомлення `m` дорівнює `Tm.x`, тобто числове повідомлення маскується саме в
x-координаті точки команди. Значення `m` не може дорівнювати нулю, тому точки з
`Tm.x = 0` не використовуються для команд. Різні команди не використовують
однакову x-координату.

## API

### Шифрування

```http
POST /api/ecc/encrypt
Content-Type: application/json
```

```json
{
  "curve": {
    "p": 79,
    "a": -3,
    "b": 1,
    "g": {
      "x": 76,
      "y": 46,
      "infinity": false
    },
    "n": 81
  },
  "command": "MOVE_FORWARD_5M"
}
```

### Дешифрування

```http
POST /api/ecc/decrypt
Content-Type: application/json
```

```json
{
  "curve": {
    "p": 79,
    "a": -3,
    "b": 1,
    "g": {
      "x": 76,
      "y": 46,
      "infinity": false
    },
    "n": 81
  },
  "tx": {
    "x": 76,
    "y": 33,
    "infinity": false
  },
  "k": 14
}
```

### Перевірка власної кривої

```http
POST /api/ecc/curve/validate
Content-Type: application/json
```

```json
{
  "p": 97,
  "a": 2,
  "b": 3,
  "g": {
    "x": 3,
    "y": 6,
    "infinity": false
  },
  "n": null
}
```

Якщо `n` не передано, застосунок сам обчислює порядок точки `G`.

## Особливості інтерфейсу

- Можна змінювати `p`, `a`, `b`, `G.x`, `G.y`, `n`.
- `G.x`, `G.y`, `Tm.x` і `Tm.y` калібруються після `Enter` або втрати фокуса.
- Якщо введена координата не відповідає точці кривої, інтерфейс підбирає
  найближчу допустиму точку.
- `n` автоматично оновлюється як порядок вибраної точки `G`.
- Точки `Tm` можна підібрати автоматично або змінити вручну для кожної команди.
- Після шифрування або дешифрування відкривається візуалізатор кривої над `Fp`,
  де кожен етап алгоритму підсвічує відповідні точки `Tm`, `Tk`, `Tx` або `-Tk`.

## Основні файли

- `src/main/java/com/example/eccfordyploma/ecc` - власна ECC-арифметика
- `src/main/java/com/example/eccfordyploma/service/EccDemoService.java` - логіка шифрування і дешифрування
- `src/main/java/com/example/eccfordyploma/api/EccController.java` - REST API
- `src/main/resources/static` - React-фронтенд
