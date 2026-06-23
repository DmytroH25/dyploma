# ECC-шифрування команд управління

Навчально-демонстраційний веб-застосунок для дипломного проєкту
“Захищена підсистема управління віддаленим рухомим об'єктом”.

Застосунок показує, як команда управління відображається у точку еліптичної
кривої T<sub>m</sub>, маскується точкою `kG`, передається як криптограма
T<sub>x</sub> і відновлюється під час дешифрування.

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
y² = x³ - 3x + 1 mod 79
p = 79
a = -3
b = 1
G = (76, 46)
n = 81
```

Застосунок підтримує навчальні прості поля до:

```text
p <= 16451
```

Для пошуку точок використовується таблиця квадратичних лишків `y² mod p`, тому
пошук точок працює приблизно за `O(p)`, а не повним перебором `O(p²)`.

## Команди

У застосунку використовується 16 команд:

```text
MOVE_FORWARD
MOVE_BACKWARD
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

Повідомлення `m` дорівнює `Tₘ.x`, тобто числове повідомлення маскується саме в
x-координаті точки команди. Значення `m` не може дорівнювати нулю, тому точки з
`Tₘ.x = 0` не використовуються для команд.

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
  "command": "MOVE_FORWARD"
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

## Особливості інтерфейсу

- Можна змінювати `p`, `a`, `b`, `G.x`, `G.y`, `n`.
- `G.x`, `G.y`, `Tₘ.x` і `Tₘ.y` калібруються після `Enter` або втрати фокуса.
- Якщо введена координата не відповідає точці кривої, інтерфейс підбирає
  найближчу допустиму точку.
- `n` автоматично оновлюється як порядок вибраної точки `G`.
- Точки T<sub>m</sub> можна підібрати автоматично або змінити вручну для кожної команди.
- Після шифрування або дешифрування відкривається візуалізатор кривої над
  F<sub>p</sub>, де кожен етап алгоритму підсвічує відповідні точки
  T<sub>m</sub>, T<sub>k</sub>, T<sub>x</sub> або -T<sub>k</sub>.

## Основні файли

- `src/main/java/com/example/eccfordyploma/ecc` - власна ECC-арифметика
- `src/main/java/com/example/eccfordyploma/service/EccDemoService.java` - логіка шифрування і дешифрування
- `src/main/java/com/example/eccfordyploma/api/EccController.java` - REST API
- `src/main/resources/static` - React-фронтенд
