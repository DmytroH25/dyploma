# ECC-шифрування команд управління

Навчально-демонстраційний веб-застосунок для дипломного проєкту
“Захищена підсистема управління віддаленим рухомим об'єктом”.

Застосунок показує, як команда управління перетворюється на точку еліптичної
кривої у формі Веєрштрасса, маскується точкою `kG`, передається як криптограма
`Tx` і відновлюється під час дешифрування.

## Стек

- Backend: Java 21, Spring Boot
- Frontend: React, HTML, CSS. Для простого дипломного запуску React підключено
  як UMD-скрипт у `index.html`, без окремого Node/NPM build-кроку.
- Формат обміну: JSON
- База даних не використовується

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

## Запуск

```powershell
.\gradlew.bat bootRun
```

Після запуску відкрийте:

```text
http://localhost:8080
```

## API

### Шифрування

```http
POST /api/ecc/encrypt
Content-Type: application/json
```

```json
{
  "command": "MOVE_FORWARD",
  "parameter": 10
}
```

### Дешифрування

```http
POST /api/ecc/decrypt
Content-Type: application/json
```

```json
{
  "tx": {
    "x": 76,
    "y": 33,
    "infinity": false
  },
  "k": 14
}
```

## Приклад MOVE_FORWARD

Для команди `MOVE_FORWARD` використовується:

```text
m = 2
Tm = (3, 16)
```

Якщо для демонстрації взяти `k = 14`, тоді:

```text
Tk = kG = 14G = (25, 64)
Tx = Tm + Tk = (76, 33)
-Tk = (25, 15)
Tm = Tx + (-Tk) = (3, 16)
```

Відновлена точка `(3, 16)` відповідає команді `MOVE_FORWARD`.

## Основні файли

- `src/main/java/com/example/eccfordyploma/ecc` - власна ECC-арифметика
- `src/main/java/com/example/eccfordyploma/service/EccDemoService.java` - логіка шифрування і дешифрування
- `src/main/java/com/example/eccfordyploma/api/EccController.java` - REST API
- `src/main/resources/static` - React-фронтенд
