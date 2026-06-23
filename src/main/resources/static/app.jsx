const { useEffect, useMemo, useState } = React;

const defaultCurveForm = {
  p: 79,
  a: -3,
  b: 1,
  gx: 76,
  gy: 46,
  n: 81,
};

const emptyEncryption = {
  command: "MOVE_FORWARD",
};

const emptyDecryption = {
  txX: "",
  txY: "",
  k: "",
};

function pointText(point) {
  if (!point) return "-";
  if (point.infinity) return "O";
  return `(${point.x}, ${point.y})`;
}

function curvePayload(form) {
  return {
    p: Number(form.p),
    a: Number(form.a),
    b: Number(form.b),
    g: { x: Number(form.gx), y: Number(form.gy), infinity: false },
    n: form.n === "" ? null : Number(form.n),
  };
}

function integerOrNull(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function mod(value, p) {
  return ((value % p) + p) % p;
}

function quadraticResidues(p) {
  const residues = new Map();
  for (let y = 0; y < p; y += 1) {
    const residue = mod(y * y, p);
    if (!residues.has(residue)) {
      residues.set(residue, []);
    }
    residues.get(residue).push(y);
  }
  return residues;
}

function yCoordinatesForX(form, residues, x) {
  const p = integerOrNull(form.p);
  const a = integerOrNull(form.a);
  const b = integerOrNull(form.b);
  const rhs = mod(x * x * x + a * x + b, p);
  return residues.get(rhs) || [];
}

function validPointsForCurve(form) {
  const p = integerOrNull(form.p);
  const a = integerOrNull(form.a);
  const b = integerOrNull(form.b);
  if (!p || p < 5 || p > 16451 || a === null || b === null) {
    return [];
  }

  const points = [];
  const residues = quadraticResidues(p);
  for (let x = 0; x < p; x += 1) {
    for (const y of yCoordinatesForX(form, residues, x)) {
      points.push({ x, y });
    }
  }
  return points;
}

function displayPoints(points, limit = 1400) {
  if (points.length <= limit) return points;

  const step = points.length / limit;
  const sampled = [];
  for (let index = 0; index < limit; index += 1) {
    sampled.push(points[Math.floor(index * step)]);
  }
  return sampled;
}

function plotPadding(max) {
  const digits = String(max).length;
  return {
    top: 34,
    right: 22,
    bottom: 46,
    left: Math.max(38, digits * 9 + 18),
  };
}

function containsPoint(form, point) {
  const p = integerOrNull(form.p);
  const a = integerOrNull(form.a);
  const b = integerOrNull(form.b);
  if (!p || p < 5 || a === null || b === null || !point) return false;
  return mod(point.y * point.y, p) === mod(point.x * point.x * point.x + a * point.x + b, p);
}

function inverseMod(value, p) {
  let oldR = mod(value, p);
  let r = p;
  let oldS = 1;
  let s = 0;

  while (r !== 0) {
    const quotient = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  return oldR === 1 ? mod(oldS, p) : null;
}

function addPoints(form, first, second) {
  if (!first) return second;
  if (!second) return first;

  const p = integerOrNull(form.p);
  const a = integerOrNull(form.a);
  if (!p || a === null) return null;

  if (first.x === second.x && mod(first.y + second.y, p) === 0) {
    return null;
  }

  let numerator;
  let denominator;
  if (first.x === second.x && first.y === second.y) {
    numerator = 3 * first.x * first.x + a;
    denominator = 2 * first.y;
  } else {
    numerator = second.y - first.y;
    denominator = second.x - first.x;
  }

  const inverse = inverseMod(denominator, p);
  if (inverse === null) return null;

  const lambda = mod(mod(numerator, p) * inverse, p);
  const x = mod(lambda * lambda - first.x - second.x, p);
  const y = mod(lambda * (first.x - x) - first.y, p);
  return { x, y };
}

function pointOrder(form, point) {
  const p = integerOrNull(form.p);
  if (!p || !containsPoint(form, point)) return null;

  let current = null;
  const max = p + 1 + 2 * Math.floor(Math.sqrt(p)) + 1;
  for (let n = 1; n <= max; n += 1) {
    current = addPoints(form, current, point);
    if (!current) return n;
  }
  return null;
}

function withPointAndOrder(form, point) {
  const next = { ...form, gx: point.x, gy: point.y };
  const order = pointOrder(next, point);
  return { ...next, n: order ?? "" };
}

function niceAxisTicks(max, targetCount = 6) {
  if (max <= 0) return [0];
  const rawStep = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceMultiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceMultiplier * magnitude;
  const ticks = [];

  for (let tick = 0; tick <= max; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

function nearestBy(items, target, getter) {
  return items.reduce((best, item) => {
    if (!best) return item;
    return Math.abs(getter(item) - target) < Math.abs(getter(best) - target) ? item : best;
  }, null);
}

function snapPointByX(form, nextX, previousX, previousY) {
  const points = validPointsForCurve(form);
  if (points.length === 0) return null;
  const direction = nextX - previousX;
  const existingX = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
  let snappedX = existingX.includes(nextX) ? nextX : null;

  if (snappedX === null && direction > 0) {
    snappedX = existingX.find((x) => x > nextX) ?? existingX[existingX.length - 1];
  }
  if (snappedX === null && direction < 0) {
    snappedX = [...existingX].reverse().find((x) => x < nextX) ?? existingX[0];
  }
  if (snappedX === null) {
    snappedX = nearestBy(existingX, nextX, (x) => x);
  }

  return nearestBy(points.filter((point) => point.x === snappedX), previousY, (point) => point.y);
}

function snapPointByY(form, nextY, previousX, previousY) {
  const points = validPointsForCurve(form);
  if (points.length === 0) return null;
  const direction = nextY - previousY;
  const existingY = [...new Set(points.map((point) => point.y))].sort((a, b) => a - b);
  let snappedY = existingY.includes(nextY) ? nextY : null;

  if (snappedY === null && direction > 0) {
    snappedY = existingY.find((y) => y > nextY) ?? existingY[existingY.length - 1];
  }
  if (snappedY === null && direction < 0) {
    snappedY = [...existingY].reverse().find((y) => y < nextY) ?? existingY[0];
  }
  if (snappedY === null) {
    snappedY = nearestBy(existingY, nextY, (y) => y);
  }

  return nearestBy(points.filter((point) => point.y === snappedY), previousX, (point) => point.x);
}

function snapNearestPoint(form) {
  const points = validPointsForCurve(form);
  if (points.length === 0) return null;
  const gx = integerOrNull(form.gx) ?? 0;
  const gy = integerOrNull(form.gy) ?? 0;
  return points.reduce((best, point) => {
    const score = Math.abs(point.x - gx) + Math.abs(point.y - gy);
    const bestScore = Math.abs(best.x - gx) + Math.abs(best.y - gy);
    return score < bestScore ? point : best;
  }, points[0]);
}

function nearestAvailablePoint(form, targetX, usedX) {
  const points = validPointsForCurve(form);
  const available = points.filter((point) => point.x !== 0 && !usedX.has(point.x));
  if (available.length === 0) return points[0];
  return available.reduce((best, point) => {
    const score = Math.abs(point.x - targetX);
    const bestScore = Math.abs(best.x - targetX);
    if (score !== bestScore) return score < bestScore ? point : best;
    return point.y < best.y ? point : best;
  }, available[0]);
}

function normalizeCommandTable(form, commands) {
  const points = validPointsForCurve(form);
  if (points.length === 0 || commands.length === 0) return commands;

  const usedX = new Set();
  return commands.map((item) => {
    const current = item.tm ? { x: Number(item.tm.x), y: Number(item.tm.y) } : null;
    let point = current && current.x !== 0 && containsPoint(form, current) && !usedX.has(current.x)
      ? current
      : nearestAvailablePoint(form, current?.x ?? item.m, usedX);
    usedX.add(point.x);
    return { ...item, m: point.x, tm: { x: point.x, y: point.y, infinity: false } };
  });
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Сталася помилка запиту");
  }
  return data;
}

function App() {
  const [mode, setMode] = useState("encrypt");
  const [curveForm, setCurveForm] = useState(defaultCurveForm);
  const [curve, setCurve] = useState(null);
  const [commandPoints, setCommandPoints] = useState([]);
  const [curveError, setCurveError] = useState("");
  const [encryptForm, setEncryptForm] = useState(emptyEncryption);
  const [decryptForm, setDecryptForm] = useState(emptyDecryption);
  const [encryptResult, setEncryptResult] = useState(null);
  const [decryptResult, setDecryptResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingCurve, setCheckingCurve] = useState(false);

  useEffect(() => {
    fetch("/api/ecc/curve")
      .then((response) => response.json())
      .then((data) => {
        setCurve(data);
        setCommandPoints(data.commands || []);
        setCurveForm({
          p: data.p,
          a: data.a,
          b: data.b,
          gx: data.g.x,
          gy: data.g.y,
          n: data.n,
        });
      })
      .catch(() => setCurveError("Не вдалося завантажити параметри кривої"));
  }, []);

  useEffect(() => {
    setCommandPoints((current) => normalizeCommandTable(curveForm, current));
  }, [curveForm.p, curveForm.a, curveForm.b]);

  const commands = useMemo(() => curve?.commands || [], [curve]);
  const activeCommands = useMemo(
    () => (commandPoints.length > 0 ? commandPoints : commands),
    [commandPoints, commands]
  );
  const activeCurve = useMemo(() => curvePayload(curveForm), [curveForm]);

  async function validateCurve() {
    setCheckingCurve(true);
    setCurveError("");
    setError("");
    try {
      const result = await api("/api/ecc/curve/validate", activeCurve);
      setCurve(result);
      setCommandPoints(result.commands || []);
      setEncryptResult(null);
      setDecryptResult(null);
      if (!result.commands.some((item) => item.command === encryptForm.command)) {
        setEncryptForm({ ...encryptForm, command: result.commands[0]?.command || "STOP" });
      }
    } catch (event) {
      setCurveError(event.message);
    } finally {
      setCheckingCurve(false);
    }
  }

  async function encrypt() {
    setLoading(true);
    setError("");
    try {
      const result = await api("/api/ecc/encrypt", {
        curve: activeCurve,
        commandPoints: activeCommands,
        command: encryptForm.command,
      });
      setEncryptResult(result);
      setDecryptForm({
        txX: result.Tx.x,
        txY: result.Tx.y,
        k: result.k,
      });
      setMode("encrypt");
    } catch (event) {
      setError(event.message);
    } finally {
      setLoading(false);
    }
  }

  async function decrypt() {
    setLoading(true);
    setError("");
    try {
      const txX = Number(decryptForm.txX);
      const txY = Number(decryptForm.txY);
      const k = Number(decryptForm.k);
      if (!Number.isInteger(txX) || !Number.isInteger(txY)) {
        throw new Error("Координати Tₓ мають бути цілими числами");
      }
      if (!Number.isInteger(k) || k <= 0) {
        throw new Error("Скаляр k має бути цілим числом більшим за 0");
      }

      const result = await api("/api/ecc/decrypt", {
        curve: activeCurve,
        commandPoints: activeCommands,
        tx: { x: txX, y: txY, infinity: false },
        k,
      });
      setDecryptResult(result);
    } catch (event) {
      setError(event.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div>
          <h1>ECC-шифрування команд управління</h1>
          <p>
            Користувач може змінювати параметри кривої над полем Fₚ, перевіряти
            базову точку G, автоматично будувати таблицю команд і проходити
            шифрування або дешифрування за формулами еліптичних кривих.
          </p>
        </div>
        <div className="formula-panel">
          <span>Шифрування</span>
          <strong>Tₓ = Tₘ + Tₖ</strong>
          <span>Дешифрування</span>
          <strong>Tₘ = Tₓ + (-Tₖ)</strong>
        </div>
      </section>

      <section className="layout">
        <aside>
          <CurvePanel
            curve={curve}
            form={curveForm}
            setForm={setCurveForm}
            error={curveError}
            onValidate={validateCurve}
            loading={checkingCurve}
          />
          <CommandTable
            commands={activeCommands}
            curveForm={curveForm}
            setCommands={setCommandPoints}
          />
        </aside>

        <section className="workspace">
          <div className="tabs">
            <button className={mode === "encrypt" ? "active" : ""} onClick={() => setMode("encrypt")}>
              Шифрування
            </button>
            <button className={mode === "decrypt" ? "active" : ""} onClick={() => setMode("decrypt")}>
              Дешифрування
            </button>
          </div>


          {error && <div className="error">{error}</div>}

          {mode === "encrypt" ? (
            <EncryptionForm
              commands={activeCommands}
              form={encryptForm}
              setForm={setEncryptForm}
              onSubmit={encrypt}
              loading={loading}
              result={encryptResult}
            />
          ) : (
            <DecryptionForm
              form={decryptForm}
              setForm={setDecryptForm}
              onSubmit={decrypt}
              loading={loading}
              result={decryptResult}
            />
          )}

          {mode === "encrypt" && encryptResult && (
            <CurveVisualizer curveForm={curveForm} result={encryptResult} mode="encrypt" />
          )}
          {mode === "decrypt" && decryptResult && (
            <CurveVisualizer curveForm={curveForm} result={decryptResult} mode="decrypt" />
          )}
        </section>
      </section>
    </main>
  );
}

function CurvePanel({ curve, form, setForm, error, onValidate, loading }) {
  function update(name, value) {
    const draft = { ...form, [name]: value };
    if (["p", "a", "b"].includes(name)) {
      const currentPoint = { x: integerOrNull(draft.gx), y: integerOrNull(draft.gy) };
      if (currentPoint.x !== null && currentPoint.y !== null && containsPoint(draft, currentPoint)) {
        setForm(withPointAndOrder(draft, currentPoint));
        return;
      }

      const snapped = snapNearestPoint(draft);
      if (snapped) {
        setForm(withPointAndOrder(draft, snapped));
        return;
      }
    }
    setForm(draft);
  }

  function updatePointCoordinate(name, value) {
    setForm({ ...form, [name]: value });
  }

  function commitPointCoordinate(name) {
    const rawValue = form[name];
    if (rawValue === "") {
      return;
    }

    const nextValue = Number(rawValue);
    if (!Number.isInteger(nextValue)) {
      return;
    }

    const previousX = integerOrNull(form.gx) ?? 0;
    const previousY = integerOrNull(form.gy) ?? 0;
    const draft = { ...form, [name]: rawValue };
    const snapped = name === "gx"
      ? snapPointByX(draft, nextValue, previousX, previousY)
      : snapPointByY(draft, nextValue, previousX, previousY);

    if (snapped) {
      setForm(withPointAndOrder(draft, snapped));
    } else {
      setForm(draft);
    }
  }

  function commitPointCoordinateOnEnter(event, name) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPointCoordinate(name);
      event.currentTarget.blur();
    }
  }

  function snapCurrentPoint() {
    const snapped = snapNearestPoint(form);
    if (snapped) {
      setForm(withPointAndOrder(form, snapped));
    }
  }

  return (
    <section className="panel">
      <h2>Параметри еліптичної кривої</h2>
      <div className="curve-grid">
        <label>p<input type="number" value={form.p} onChange={(e) => update("p", e.target.value)} /></label>
        <label>a<input type="number" value={form.a} onChange={(e) => update("a", e.target.value)} /></label>
        <label>b<input type="number" value={form.b} onChange={(e) => update("b", e.target.value)} /></label>
        <label>G.x<input type="number" min="0" max={Number(form.p) - 1} step="1" value={form.gx} onChange={(e) => updatePointCoordinate("gx", e.target.value)} onBlur={() => commitPointCoordinate("gx")} onKeyDown={(e) => commitPointCoordinateOnEnter(e, "gx")} /></label>
        <label>G.y<input type="number" min="0" max={Number(form.p) - 1} step="1" value={form.gy} onChange={(e) => updatePointCoordinate("gy", e.target.value)} onBlur={() => commitPointCoordinate("gy")} onKeyDown={(e) => commitPointCoordinateOnEnter(e, "gy")} /></label>
        <label>n<input type="number" value={form.n} onChange={(e) => update("n", e.target.value)} /></label>
      </div>
      <button className="secondary full" onClick={snapCurrentPoint}>
        Підібрати найближчу G
      </button>
      <button className="primary full" onClick={onValidate} disabled={loading}>
        {loading ? "Перевірка..." : "Перевірити криву"}
      </button>

      {error && <div className="error compact">{error}</div>}
      {!curve ? (
        <p className="muted">Завантаження...</p>
      ) : (
        <dl className="details curve-status">
          <div><dt>Рівняння</dt><dd>{curve.equation}</dd></div>
          <div><dt>G</dt><dd>{pointText(curve.g)}</dd></div>
          <div><dt>Точок на кривій</dt><dd>{curve.pointCount}</dd></div>
          <div><dt>Порядок G</dt><dd>{curve.subgroupOrder}</dd></div>
          <div><dt>Поле</dt><dd>{curve.primeField ? "p просте" : "p не просте"}</dd></div>
          <div><dt>Стан кривої</dt><dd>{curve.nonsingular ? "несингулярна" : "сингулярна"}</dd></div>
        </dl>
      )}
      <p className="note">
        Таблиця команд нижче будується автоматично: для кожного m шукається
        допустима найближча точка Tₘ на поточній кривій.
      </p>
    </section>
  );
}

function CommandTable({ commands, curveForm, setCommands }) {
  function updateCommandPoint(index, coordinate, value) {
    setCommands((current) => {
      const source = current.length > 0 ? current : commands;
      const next = source.map((item) => ({
        ...item,
        tm: { ...item.tm },
      }));
      const item = next[index];
      if (!item) return source;
      item.tm = { ...item.tm, [coordinate]: value, infinity: false };
      return next;
    });
  }

  function commitCommandPoint(index, coordinate) {
    setCommands((current) => {
      const source = current.length > 0 ? current : commands;
      const next = source.map((item) => ({
        ...item,
        tm: { ...item.tm },
      }));
      const item = next[index];
      if (!item) return source;

      const rawValue = item.tm?.[coordinate];
      if (rawValue === "") return next;
      const nextValue = Number(rawValue);
      if (!Number.isInteger(nextValue)) return next;

      const previousX = integerOrNull(item.tm.x) ?? 0;
      const previousY = integerOrNull(item.tm.y) ?? 0;
      const snapped = coordinate === "x"
        ? snapPointByX(curveForm, nextValue, previousX, previousY)
        : snapPointByY(curveForm, nextValue, previousX, previousY);

      if (snapped) {
        const usedX = new Set(
          next
            .filter((_, itemIndex) => itemIndex !== index)
            .map((command) => Number(command.tm?.x))
        );
        const point = snapped.x === 0 || usedX.has(snapped.x)
          ? nearestAvailablePoint(curveForm, snapped.x, usedX)
          : snapped;
        item.m = point.x;
        item.tm = { x: point.x, y: point.y, infinity: false };
      }
      return next;
    });
  }

  function commitCommandPointOnEnter(event, index, coordinate) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitCommandPoint(index, coordinate);
      event.currentTarget.blur();
    }
  }

  function autoFill() {
    const points = validPointsForCurve(curveForm);
    if (points.length === 0) return;
    const usedX = new Set();
    const next = commands.map((item) => {
      const point = nearestAvailablePoint(curveForm, item.m, usedX);
      usedX.add(point.x);
      return { ...item, m: point.x, tm: { x: point.x, y: point.y, infinity: false } };
    });
    setCommands(next);
  }

  return (
    <section className="panel">
      <h2>Команди управління</h2>
      <button className="secondary full table-action" onClick={autoFill}>
        Автоматично підібрати Tₘ
      </button>
      <div className="table">
        <div className="row command-editor head"><span>Команда</span><span>m</span><span>Tₘ.x</span><span>Tₘ.y</span></div>
        {commands.map((item, index) => (
          <div className="row command-editor" key={item.command}>
            <span>{item.command}</span>
            <span>{item.m}</span>
            <input
              type="number"
              min="0"
              max={Number(curveForm.p) - 1}
              step="1"
              value={item.tm?.x ?? ""}
              onChange={(event) => updateCommandPoint(index, "x", event.target.value)}
              onBlur={() => commitCommandPoint(index, "x")}
              onKeyDown={(event) => commitCommandPointOnEnter(event, index, "x")}
            />
            <input
              type="number"
              min="0"
              max={Number(curveForm.p) - 1}
              step="1"
              value={item.tm?.y ?? ""}
              onChange={(event) => updateCommandPoint(index, "y", event.target.value)}
              onBlur={() => commitCommandPoint(index, "y")}
              onKeyDown={(event) => commitCommandPointOnEnter(event, index, "y")}
            />
          </div>
        ))}
      </div>
      <p className="note">
        Кожна Tₘ має бути реальною точкою поточної кривої. Якщо координата не
        існує, поле перескакує до найближчої допустимої точки.
      </p>
    </section>
  );
}

function EncryptionForm({ commands, form, setForm, onSubmit, loading, result }) {
  return (
    <section className="panel large">
      <h2>Шифрування команди</h2>
      <div className="form-grid single">
        <label>
          Команда
          <select
            value={form.command}
            onChange={(event) => setForm({ ...form, command: event.target.value })}
          >
            {commands.map((item) => (
              <option key={item.command} value={item.command}>{item.command}</option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary" onClick={onSubmit} disabled={loading || commands.length === 0}>
        {loading ? "Обчислення..." : "Зашифрувати"}
      </button>

      {result && (
        <ResultBlock
          title="Результат шифрування"
          rows={[
            ["Команда", result.command],
            ["Числове значення m", result.m],
            ["Точка команди Tₘ", pointText(result.Tm)],
            ["Випадковий скаляр k", result.k],
            ["Маскувальна точка Tₖ", pointText(result.Tk)],
            ["Криптограма Tₓ", pointText(result.Tx)],
            ["Формула", result.formula],
          ]}
        />
      )}
    </section>
  );
}

function DecryptionForm({ form, setForm, onSubmit, loading, result }) {
  return (
    <section className="panel large">
      <h2>Дешифрування криптограми</h2>
      <div className="form-grid three">
        <label>
          Tₓ.x
          <input
            type="number"
            value={form.txX}
            onChange={(event) => setForm({ ...form, txX: event.target.value })}
            placeholder="x"
          />
        </label>
        <label>
          Tₓ.y
          <input
            type="number"
            value={form.txY}
            onChange={(event) => setForm({ ...form, txY: event.target.value })}
            placeholder="y"
          />
        </label>
        <label>
          k
          <input
            type="number"
            value={form.k}
            onChange={(event) => setForm({ ...form, k: event.target.value })}
            placeholder="k"
          />
        </label>
      </div>
      <button className="primary" onClick={onSubmit} disabled={loading}>
        {loading ? "Обчислення..." : "Дешифрувати"}
      </button>

      {result && (
        <ResultBlock
          title="Результат дешифрування"
          rows={[
            ["Отримана криптограма Tₓ", pointText(result.Tx)],
            ["Скаляр k", result.k],
            ["Маскувальна точка Tₖ", pointText(result.Tk)],
            ["Обернена точка -Tₖ", pointText(result.negativeTk)],
            ["Відновлена точка Tₘ", pointText(result.Tm)],
            ["Відновлене m", result.m],
            ["Відновлена команда", result.command],
            ["Формула", result.formula],
          ]}
        />
      )}
    </section>
  );
}

function CurveVisualizer({ curveForm, result, mode }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [pointMode, setPointMode] = useState("sample");
  const points = useMemo(() => validPointsForCurve(curveForm), [curveForm]);
  const plottedPoints = useMemo(
    () => (pointMode === "all" ? points : displayPoints(points)),
    [pointMode, points]
  );
  const p = integerOrNull(curveForm.p) || 1;
  const size = 780;
  const max = Math.max(1, p - 1);
  const pad = plotPadding(max);
  const plotWidth = size - pad.left - pad.right;
  const plotHeight = size - pad.top - pad.bottom;
  const pointRadius = p > 5000 ? 1.35 : p > 1000 ? 1.7 : 3.2;

  useEffect(() => {
    setStageIndex(0);
  }, [result, mode]);

  function sx(x) {
    return pad.left + (Number(x) / max) * plotWidth;
  }

  function sy(y) {
    return pad.top + plotHeight - (Number(y) / max) * plotHeight;
  }

  function pointFromDto(point) {
    if (!point || point.infinity) return null;
    return { x: Number(point.x), y: Number(point.y) };
  }

  const axisTicks = niceAxisTicks(max);

  const stages = mode === "encrypt"
    ? [
        {
          title: "1. Повідомлення у точці Tₘ",
          formula: "m = x(Tₘ)",
          points: [{ label: "Tₘ", point: pointFromDto(result.Tm), role: "message" }],
        },
        {
          title: "2. Маскувальна точка Tₖ",
          formula: `Tₖ = kG, k = ${result.k}`,
          points: [{ label: "Tₖ", point: pointFromDto(result.Tk), role: "mask" }],
        },
        {
          title: "3. Криптограма Tₓ",
          formula: "Tₓ = Tₘ + Tₖ",
          points: [
            { label: "Tₘ", point: pointFromDto(result.Tm), role: "message" },
            { label: "Tₖ", point: pointFromDto(result.Tk), role: "mask" },
            { label: "Tₓ", point: pointFromDto(result.Tx), role: "result" },
          ],
          line: [pointFromDto(result.Tm), pointFromDto(result.Tk)],
        },
      ]
    : [
        {
          title: "1. Отримана криптограма",
          formula: "Tₓ = (x, y)",
          points: [{ label: "Tₓ", point: pointFromDto(result.Tx), role: "result" }],
        },
        {
          title: "2. Повторне обчислення маски",
          formula: `Tₖ = kG, k = ${result.k}`,
          points: [{ label: "Tₖ", point: pointFromDto(result.Tk), role: "mask" }],
        },
        {
          title: "3. Обернена точка",
          formula: "-Tₖ = (x, -y mod p)",
          points: [
            { label: "Tₖ", point: pointFromDto(result.Tk), role: "mask" },
            { label: "-Tₖ", point: pointFromDto(result.negativeTk), role: "inverse" },
          ],
        },
        {
          title: "4. Відновлення Tₘ",
          formula: "Tₘ = Tₓ + (-Tₖ)",
          points: [
            { label: "Tₓ", point: pointFromDto(result.Tx), role: "result" },
            { label: "-Tₖ", point: pointFromDto(result.negativeTk), role: "inverse" },
            { label: "Tₘ", point: pointFromDto(result.Tm), role: "message" },
          ],
          line: [pointFromDto(result.Tx), pointFromDto(result.negativeTk)],
        },
      ];

  const stage = stages[stageIndex];
  const visiblePoints = stage.points.filter((item) => item.point);

  return (
    <section className="visualizer">
      <header className="visualizer-head">
        <h2>Покрокові операції на еліптичній кривій (F<sub>p</sub>)</h2>
        <div className="visualizer-controls">
          <div className="visualizer-tabs" aria-label="Крок алгоритму">
            {stages.map((item, index) => (
              <button
                key={item.title}
                className={index === stageIndex ? "active" : ""}
                onClick={() => setStageIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="point-mode-tabs" aria-label="Режим точок">
            <button
              className={pointMode === "sample" ? "active" : ""}
              onClick={() => setPointMode("sample")}
            >
              Вибірка
            </button>
            <button
              className={pointMode === "all" ? "active" : ""}
              onClick={() => setPointMode("all")}
            >
              Усі точки
            </button>
          </div>
        </div>
      </header>

      <div className="visualizer-grid">
        <svg className="curve-canvas" viewBox={`0 0 ${size} ${size}`} role="img">
          <rect x={pad.left} y={pad.top} width={plotWidth} height={plotHeight} />
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line x1={pad.left + ratio * plotWidth} y1={pad.top} x2={pad.left + ratio * plotWidth} y2={pad.top + plotHeight} />
              <line x1={pad.left} y1={pad.top + ratio * plotHeight} x2={pad.left + plotWidth} y2={pad.top + ratio * plotHeight} />
            </g>
          ))}

          {axisTicks.map((tick) => (
            <g className="axis-tick" key={`x-${tick}`}>
              <line x1={sx(tick)} y1={pad.top + plotHeight} x2={sx(tick)} y2={pad.top + plotHeight + 6} />
              <text x={sx(tick)} y={pad.top + plotHeight + 23}>{tick}</text>
            </g>
          ))}

          {axisTicks.map((tick) => (
            <g className="axis-tick" key={`y-${tick}`}>
              <line x1={pad.left - 6} y1={sy(tick)} x2={pad.left} y2={sy(tick)} />
              <text className="y-tick" x={pad.left - 12} y={sy(tick) + 5}>{tick}</text>
            </g>
          ))}

          {plottedPoints.map((point) => (
            <circle key={`${point.x}:${point.y}`} className="curve-point" cx={sx(point.x)} cy={sy(point.y)} r={pointRadius} />
          ))}

          {stage.line?.[0] && stage.line?.[1] && (
            <line
              className="operation-line"
              x1={sx(stage.line[0].x)}
              y1={sy(stage.line[0].y)}
              x2={sx(stage.line[1].x)}
              y2={sy(stage.line[1].y)}
            />
          )}

          {visiblePoints.map((item) => (
            <g key={item.label} className={`highlight-point ${item.role}`}>
              <circle cx={sx(item.point.x)} cy={sy(item.point.y)} r="16" />
              <text x={sx(item.point.x)} y={sy(item.point.y) + 5}>{item.label}</text>
            </g>
          ))}
        </svg>

        <aside className="visualizer-side">
          <dl className="visualizer-fields">
            <div><dt>Крива</dt><dd>a = {curveForm.a}, b = {curveForm.b}</dd></div>
            <div><dt>Поле</dt><dd>p = {curveForm.p}</dd></div>
            <div><dt>Крок</dt><dd>{stage.title}</dd></div>
            <div><dt>Формула</dt><dd>{stage.formula}</dd></div>
          </dl>

          <div className="point-list">
            {visiblePoints.map((item) => (
              <div className={`point-pill ${item.role}`} key={item.label}>
                <strong>{item.label}</strong>
                <span>{pointText(item.point)}</span>
              </div>
            ))}
          </div>

          {pointMode === "sample" && plottedPoints.length < points.length && (
            <p className="plot-note">
              Для швидкої роботи графіка показано {plottedPoints.length} з {points.length} точок кривої.
              Точки поточного етапу завжди відображаються повністю.
            </p>
          )}

          {pointMode === "all" && (
            <p className="plot-note">
              У режимі повного графіка показано всі {points.length} точок кривої.
            </p>
          )}

          <p>
            Точки кривої показані блакитними маркерами. Поточний етап
            підсвічує саме ті точки, які беруть участь у відповідній формулі.
          </p>
        </aside>
      </div>
    </section>
  );
}

function ResultBlock({ title, rows }) {
  return (
    <section className="result">
      <h3>{title}</h3>
      <dl className="details result-details">
        {rows.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
