interface Account {
  dp: string
  username: string
  password: string
  pin: string
  crn: string
  units: string
}

interface AccountsTableProps {
  accounts: Account[]
}

export default function AccountsTable({ accounts }: AccountsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left">DP</th>
            <th className="px-4 py-2 text-left">Username</th>
            <th className="px-4 py-2 text-left">CRN</th>
            <th className="px-4 py-2 text-left">Units</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account, idx) => (
            <tr key={idx} className="border-t hover:bg-muted/50">
              <td className="px-4 py-2 font-mono text-xs">{account.dp}</td>
              <td className="px-4 py-2">{account.username}</td>
              <td className="px-4 py-2 font-mono text-xs">{account.crn}</td>
              <td className="px-4 py-2">{account.units}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
