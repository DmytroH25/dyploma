const { useEffect, useMemo, useState } = React;

const emptyEncryption = {
  command: "MOVE_FORWARD",
  parameter: 10,
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
  const [curve, setCurve] = useState(null);
  const [curveError, setCurveError] = useState("");
  const [encryptForm, setEncryptForm] = useState(emptyEncryption);
  const [decryptForm, setDecryptForm] = useState(emptyDecryption);
  const [encryptResult, setEncryptResult] = useState(null);
  const [decryptResult, setDecryptResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/ecc/curve")
      .then((response) => response.json())
      .then(setCurve)
      .catch(() => setCurveError("Не вдалося завантажити параметри кривої"));
  }, []);

  const commands = useMemo(() => curve?.commands || [], [curve]);

  async function encrypt() {
    setLoading(true);
    setError("");
    try {
      const result = await api("/api/ecc/encrypt", {
        command: encryptForm.command,
        parameter: encryptForm.parameter === "" ? null : Number(encryptForm.parameter),
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
        throw new Error("Координати Tx мають бути цілими числами");
      }
      if (!Number.isInteger(k) || k <= 0) {
        throw new Error("Скаляр k має бути цілим числом більшим за 0");
      }

      const result = await api("/api/ecc/decrypt", {
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
          <p className="eyebrow">Дипломний демонстратор</p>
          <h1>ECC-шифрування команд управління</h1>
          <p>
            Навчально-демонстраційний веб-застосунок для підсистеми управління
            віддаленим рухомим об'єктом. Команда перетворюється на точку Tm,
            маскується точкою kG і передається як криптограма Tx.
          </p>
        </div>
        <div className="formula-panel">
          <span>Шифрування</span>
          <strong>Tx = Tm + kG</strong>
          <span>Дешифрування</span>
          <strong>Tm = Tx + (-kG)</strong>
        </div>
      </section>

      <section className="layout">
        <aside>
          <CurvePanel curve={curve} error={curveError} />
          <CommandTable commands={commands} />
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
              commands={commands}
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
        </section>
      </section>
    </main>
  );
}

function CurvePanel({ curve, error }) {
  return (
    <section className="panel">
      <h2>Параметри еліптичної кривої</h2>
      {error && <p className="muted">{error}</p>}
      {!curve ? (
        <p className="muted">Завантаження...</p>
      ) : (
        <dl className="details">
          <div><dt>Рівняння</dt><dd>{curve.equation}</dd></div>
          <div><dt>p</dt><dd>{curve.p}</dd></div>
          <div><dt>a</dt><dd>{curve.a}</dd></div>
          <div><dt>b</dt><dd>{curve.b}</dd></div>
          <div><dt>G</dt><dd>{pointText(curve.g)}</dd></div>
          <div><dt>n</dt><dd>{curve.n}</dd></div>
        </dl>
      )}
    </section>
  );
}

function CommandTable({ commands }) {
  return (
    <section className="panel">
      <h2>Команди управління</h2>
      <div className="table">
        <div className="row head"><span>Команда</span><span>m</span><span>Tm</span></div>
        {commands.map((item) => (
          <div className="row" key={item.command}>
            <span>{item.command}</span>
            <span>{item.m}</span>
            <span>{pointText(item.tm)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EncryptionForm({ commands, form, setForm, onSubmit, loading, result }) {
  return (
    <section className="panel large">
      <h2>Шифрування команди</h2>
      <div className="form-grid">
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
        <label>
          Параметр команди
          <input
            type="number"
            value={form.parameter}
            onChange={(event) => setForm({ ...form, parameter: event.target.value })}
            placeholder="Наприклад, 10"
          />
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
            ["Параметр", result.parameter ?? "-"],
            ["Точка команди Tm", pointText(result.Tm)],
            ["Випадковий скаляр k", result.k],
            ["Маскувальна точка Tk", pointText(result.Tk)],
            ["Криптограма Tx", pointText(result.Tx)],
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
          Tx.x
          <input
            type="number"
            value={form.txX}
            onChange={(event) => setForm({ ...form, txX: event.target.value })}
            placeholder="x"
          />
        </label>
        <label>
          Tx.y
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
            ["Отримана криптограма Tx", pointText(result.Tx)],
            ["Скаляр k", result.k],
            ["Маскувальна точка Tk", pointText(result.Tk)],
            ["Обернена точка -Tk", pointText(result.negativeTk)],
            ["Відновлена точка Tm", pointText(result.Tm)],
            ["Відновлене m", result.m],
            ["Відновлена команда", result.command],
            ["Формула", result.formula],
          ]}
        />
      )}
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
