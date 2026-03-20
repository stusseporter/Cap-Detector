import { Switch, Route } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import Home from '@/pages/Home';
import RunView from '@/pages/RunView';
import ReportView from '@/pages/ReportView';
import HistoryPage from '@/pages/HistoryPage';
import NotFound from '@/pages/NotFound';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/run" component={RunView} />
      <Route path="/report/:id" component={ReportView} />
      <Route path="/history" component={HistoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
