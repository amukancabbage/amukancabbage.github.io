import CrudPage, { type Field } from '../components/CrudPage';
import type { Prodi } from '../types';

const fields: Field<Prodi>[] = [{ name: 'prodi', label: 'Prodi', required: true }];

export default function ProdiPage() {
  return <CrudPage<Prodi> title="Prodi" table="prodi" select="id, prodi" fields={fields} />;
}
