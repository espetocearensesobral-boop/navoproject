const fs = require('fs');
let code = fs.readFileSync('src/components/client/BookingStep1Services.tsx', 'utf8');

// Add AlertCircle to lucide-react imports
code = code.replace("Loader2\n} from 'lucide-react';", "Loader2,\n  AlertCircle\n} from 'lucide-react';");

// Add errorMessage state
code = code.replace(
  "const [isAdvancing, setIsAdvancing] = useState(false);",
  "const [isAdvancing, setIsAdvancing] = useState(false);\n  const [errorMessage, setErrorMessage] = useState<string | null>(null);"
);

// Update loadData function
const oldLoadData = `  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const data = await fetchServicesFromSupabase();
        if (isMounted) {
          setServices(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao carregar serviços:', err);
        if (isMounted) {
          setServices([]);
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);`;

const newLoadData = `  async function loadData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchServicesFromSupabase();
      setServices(data);
      setLoading(false);
    } catch (err: any) {
      console.error('Erro ao carregar serviços:', err);
      setServices([]);
      setLoading(false);
      setErrorMessage(err?.message || 'Sem conexão com o banco de dados. O agendamento está suspenso no momento.');
    }
  }

  useEffect(() => {
    loadData();
  }, []);`;

code = code.replace(oldLoadData, newLoadData);

// Update JSX rendering to display errorMessage banner
const oldRenderStart = `{/* Services Content - Netflix Style Horizontal Rows */}
      {loading ? (`;

const newRenderStart = `{/* Services Content - Netflix Style Horizontal Rows */}
      {errorMessage ? (
        <div className="py-10 px-6 my-6 mx-auto max-w-md flex flex-col items-center justify-center text-center space-y-3 bg-status-error/10 border border-status-error/30 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-status-error/20 text-status-error flex items-center justify-center">
            <AlertCircle className="w-7 h-7 stroke-[2]" />
          </div>
          <p className="text-content-base font-extrabold text-base">Sistema Indisponível</p>
          <p className="text-xs text-content-muted leading-relaxed">
            {errorMessage}
          </p>
          <button
            onClick={() => loadData()}
            className="mt-2 px-5 py-2.5 rounded-xl bg-status-error/20 hover:bg-status-error/30 text-status-error text-xs font-extrabold border border-status-error/30 transition-all active:scale-95 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      ) : loading ? (`;

code = code.replace(oldRenderStart, newRenderStart);

fs.writeFileSync('src/components/client/BookingStep1Services.tsx', code);
console.log('Updated BookingStep1Services.tsx with error state handling.');
