import paramiko, os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.1.45.10', port=22, username='cas_hue', password=os.environ.get('SFTP_PASSWORD'), timeout=10)
sftp = ssh.open_sftp()
folders = sftp.listdir('/')
print('Ket noi thanh cong!')
print('Cac folder tren server:')
for f in sorted(folders)[-10:]:
    print(' ', f)
sftp.close()
ssh.close()
