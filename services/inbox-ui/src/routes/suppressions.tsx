import { createFileRoute } from '@tanstack/react-router';
import Layout from '../components/Layout';
import Suppressions from '../pages/Suppressions';

export const Route = createFileRoute('/suppressions')({
  component: () => <Layout><Suppressions /></Layout>,
});
